import React, { useEffect, useRef, useState } from 'react';
import {
  createChart, IChartApi, ISeriesApi,
  CandlestickData as LWCCandlestickData, LineData as LWCLineData, HistogramData as LWCHistogramData,
  LineStyle, UTCTimestamp, PriceScaleMode, IPriceLine, DeepPartial, ChartOptions, SeriesMarker, Time, ColorType,
  CandlestickSeriesOptions, LineSeriesOptions, HistogramSeriesOptions // Removed SeriesType and SeriesOptionsMap
} from 'lightweight-charts';
import pako from 'pako';
import { DataSource, GeminiAnalysisResult, TickerData, AnalysisPointType, MovingAverageConfig, FibonacciLevel, MarketDataPoint } from '../types'; // Removed DeltaZoneSettings
import { mapTimeframeToApi } from '../constants';
import { generateUUID } from '../utils/uuid';
// import { IndicatorName } from '../App'; // No longer needed as RSI is removed

type Theme = 'dark' | 'light';

interface RealTimeTradingChartProps {
  dataSource: DataSource;
  symbol: string;
  timeframe: string;
  analysisResult: GeminiAnalysisResult | null;
  onLatestChartInfoUpdate: (info: { price: number | null; volume?: number | null }) => void; // RSI removed
  onChartLoadingStateChange: (isLoading: boolean) => void;
  movingAverages: MovingAverageConfig[];
  theme: Theme;
  chartPaneBackgroundColor: string;
  volumePaneHeight: number;
  showAiAnalysisDrawings: boolean;
  wSignalColor: string; // Hex color string e.g. #FFD700
  wSignalOpacity: number; // Opacity from 0 to 1
  showWSignals: boolean; // New prop to control W-Signal visibility
  // 📝 Paso 1: Nueva prop para recibir los datos históricos
  onHistoricalDataUpdate: (data: MarketDataPoint[]) => void;
  // RSI and DeltaZoneSettings props removed
  // rsiColor: string;
  // deltaZoneSettings: DeltaZoneSettings;
  // indicatorDisplayOrder: IndicatorName[];
  // rsiPaneHeight: number;
  // showRsi: boolean;
}

// Use UTCTimestamp consistently for time data
type CandlestickData = LWCCandlestickData<UTCTimestamp> & { volume?: number };
type LineData = LWCLineData<UTCTimestamp>;
type HistogramData = LWCHistogramData<UTCTimestamp>;

interface BaseProviderConfig {
  name: string;
  historicalApi: (symbol: string, interval: string) => string;
  formatSymbol: (s: string) => string;
  parseKline: (data: any) => CandlestickData;
  parseTicker: (data: any, currentSymbol: string, currentProvider: DataSource) => Partial<TickerData>;
}

interface BinanceProviderConfig extends BaseProviderConfig {
  type: 'binance';
  wsKline: (symbol: string, interval: string) => string;
  wsTicker: (symbol: string) => string;
  parseHistorical: (data: any[]) => CandlestickData[];
}

interface BingXProviderConfig extends BaseProviderConfig {
  type: 'bingx';
  wsBase: string;
  getKlineSubMessage: (symbol: string, interval: string) => string;
  getTickerSubMessage: (symbol: string) => string;
  parseHistorical: (allOriginsResponse: any) => CandlestickData[];
}

type CurrentProviderConfig = BinanceProviderConfig | BingXProviderConfig;

const PROVIDERS_CONFIG: { binance: BinanceProviderConfig; bingx: BingXProviderConfig } = {
  binance: {
    type: 'binance',
    name: 'Binance Futures',
    historicalApi: (symbol, interval) => `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=500`,
    wsKline: (symbol, interval) => `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@kline_${interval}`,
    wsTicker: (symbol) => `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@ticker`,
    formatSymbol: (s) => s.replace(/[^A-Z0-9]/g, '').toUpperCase(),
    parseHistorical: (data) => data.map(k => ({ time: k[0] / 1000 as UTCTimestamp, open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]) })),
    parseKline: (data) => ({ time: data.k.t / 1000 as UTCTimestamp, open: parseFloat(data.k.o), high: parseFloat(data.k.h), low: parseFloat(data.k.l), close: parseFloat(data.k.c), volume: parseFloat(data.k.v) }),
    parseTicker: (data, currentSymbol, currentProvider) => ({ price: parseFloat(data.c), changePercent: parseFloat(data.P), volume: parseFloat(data.v), quoteVolume: parseFloat(data.q), symbol: currentSymbol, provider: currentProvider })
  },
  bingx: {
    type: 'bingx',
    name: 'BingX Futures',
    historicalApi: (symbol, interval) => `https://api.allorigins.win/raw?url=https://open-api.bingx.com/openApi/swap/v2/quote/klines?symbol=${symbol}&interval=${interval}&limit=500`,
    wsBase: 'wss://open-api-swap.bingx.com/swap-market',
    formatSymbol: (s) => s.toUpperCase(),
    parseHistorical: (allOriginsParsedResponse: any): CandlestickData[] => {
      if (allOriginsParsedResponse && typeof allOriginsParsedResponse.contents === 'string') {
        try {
          const bingxApiResponse = JSON.parse(allOriginsParsedResponse.contents);
          if (bingxApiResponse && bingxApiResponse.code === "0" && Array.isArray(bingxApiResponse.data)) {
            return bingxApiResponse.data.map(k => ({
              time: k.time / 1000 as UTCTimestamp,
              open: parseFloat(k.open),
              high: parseFloat(k.high),
              low: parseFloat(k.low),
              close: parseFloat(k.close),
              volume: parseFloat(k.volume)
            }));
          } else {
            console.error("BingX API error or malformed data in 'contents':", bingxApiResponse?.msg || "Malformed data", bingxApiResponse);
            throw new Error(`BingX API error: ${bingxApiResponse?.msg || "Malformed data in 'contents'."}`);
          }
        } catch (e) {
          console.error("Error parsing BingX 'contents' string from allorigins.win as JSON:", e, allOriginsParsedResponse.contents);
          throw new Error("Error parsing BingX 'contents' string from allorigins.win as JSON.");
        }
      } else {
        console.error("Invalid response structure from allorigins.win proxy for BingX historical data. 'contents' field missing or not a string:", allOriginsParsedResponse);
        throw new Error("Invalid response structure from allorigins.win proxy for BingX historical data.");
      }
    },
    getKlineSubMessage: (symbol, interval) => JSON.stringify({ id: generateUUID(), reqType: 'sub', dataType: `${symbol}@kline_${interval}` }),
    getTickerSubMessage: (symbol) => JSON.stringify({ id: generateUUID(), reqType: 'sub', dataType: `${symbol}@trade` }),
    parseKline: (data) => ({ time: data.T / 1000 as UTCTimestamp, open: parseFloat(data.o), high: parseFloat(data.h), low: parseFloat(data.l), close: parseFloat(data.c), volume: parseFloat(data.v) }),
    parseTicker: (data, currentSymbol, currentProvider) => ({ price: parseFloat(data.p), symbol: currentSymbol, provider: currentProvider })
  }
};

// calculateRSI function removed

export const calculateMA = (data: CandlestickData[], period: number): LineData[] => {
  if (data.length < period) return [];
  const results: LineData[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0; for (let j = 0; j < period; j++) { sum += data[i - j].close; }
    results.push({ time: data[i].time, value: sum / period });
  }
  return results;
};

export const calculateEMA = (data: CandlestickData[], period: number): LineData[] => {
  if (data.length < period) return [];
  const results: LineData[] = []; const k = 2 / (period + 1);
  let sumForSma = 0; for (let i = 0; i < period; i++) { sumForSma += data[i].close; }
  let ema = sumForSma / period; results.push({ time: data[period - 1].time, value: ema });
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * k + ema; results.push({ time: data[i].time, value: ema });
  }
  return results;
};

const isColorLight = (hexColor: string): boolean => {
  const color = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
  if (color.length !== 6 && color.length !== 3) return true;
  let r, g, b;
  if (color.length === 3) {
    r = parseInt(color[0] + color[0], 16); g = parseInt(color[1] + color[1], 16); b = parseInt(color[2] + color[2], 16);
  } else {
    r = parseInt(color.substring(0, 2), 16); g = parseInt(color.substring(2, 4), 16); b = parseInt(color.substring(4, 6), 16);
  }
  return ((0.299 * r + 0.587 * g + 0.114 * b) / 255) > 0.5;
};

const THEME_COLORS = {
  light: { background: '#FFFFFF', text: '#000000', grid: '#e5e7eb', border: '#d1d5db', /* rsiBand removed */ fiboRetracement: 'rgba(59, 130, 246, 0.7)', fiboExtension: 'rgba(249, 115, 22, 0.7)' },
  dark: { background: '#0f172a', text: '#FFFFFF', grid: '#1e293b', border: '#334155', /* rsiBand removed */ fiboRetracement: 'rgba(96, 165, 250, 0.7)', fiboExtension: 'rgba(251, 146, 60, 0.7)' }
};

const getChartLayoutOptions = (
  effectiveBackgroundColor: string, effectiveTextColor: string, gridColor: string, borderColor: string
): DeepPartial<ChartOptions> => ({
  layout: {
    background: { type: ColorType.Solid, color: effectiveBackgroundColor },
    textColor: effectiveTextColor // General text color
  },
  grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
  // Time scale and price scale text colors will be set explicitly after chart creation
});

// DeltaSignalOutput and calculateDeltaSignals removed

const RealTimeTradingChart: React.FC<RealTimeTradingChartProps> = ({
  dataSource, symbol: rawSymbol, timeframe: rawTimeframe, analysisResult,
  onLatestChartInfoUpdate, onChartLoadingStateChange, movingAverages, theme,
  chartPaneBackgroundColor, volumePaneHeight, showAiAnalysisDrawings,
  wSignalColor, wSignalOpacity, showWSignals,
  onHistoricalDataUpdate // 📝 Extraer la nueva prop
  // RSI and DeltaZone props removed
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'>>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'>>(null);
  // rsiSeriesRef removed
  // projectionSeriesRef removed - eliminamos la línea de proyección
  const analysisPriceLinesRef = useRef<IPriceLine[]>([]);
  const maSeriesRefs = useRef<Record<string, ISeriesApi<'Line'>>>({});
  // rsiBandLinesRef removed

  const volumePriceScaleIdRef = useRef<string | null>(null);
  // rsiPriceScaleIdRef removed

  const [historicalData, setHistoricalData] = useState<CandlestickData[]>([]);
  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'ok' | 'error'>('connecting');
  const [currentIntervalInSeconds, setCurrentIntervalInSeconds] = useState<number>(3600);

  const providerConf = PROVIDERS_CONFIG[dataSource];
  const formattedSymbol = rawSymbol && providerConf ? providerConf.formatSymbol(rawSymbol) : '';
  const apiTimeframe = mapTimeframeToApi(rawTimeframe);

  const getStrokeColor = (type: AnalysisPointType | string, isFvg: boolean = false): string => {
    const opacity = isFvg ? '0.3' : '0.7';
    switch (type) {
      case AnalysisPointType.POI_OFERTA:
      case AnalysisPointType.FVG_BAJISTA:
        return `rgba(239, 68, 68, ${opacity})`;
      case AnalysisPointType.POI_DEMANDA:
      case AnalysisPointType.FVG_ALCISTA:
        return `rgba(34, 197, 94, ${opacity})`;
      case AnalysisPointType.LIQUIDEZ_COMPRADORA:
        return `rgba(59, 130, 246, ${opacity})`;
      case AnalysisPointType.LIQUIDEZ_VENDEDORA:
        return `rgba(249, 115, 22, ${opacity})`;
      case AnalysisPointType.BOS_ALCISTA:
      case AnalysisPointType.CHOCH_ALCISTA:
        return `rgba(16, 185, 129, ${opacity})`;
      case AnalysisPointType.BOS_BAJISTA:
      case AnalysisPointType.CHOCH_BAJISTA:
        return `rgba(220, 38, 38, ${opacity})`;
      case AnalysisPointType.EQUILIBRIUM:
        return `rgba(107, 114, 128, ${opacity})`;
      default: return `rgba(156, 163, 175, ${opacity})`;
    }
  };

  const getTextColorForZone = (bgColor: string) => {
    return isColorLight(bgColor) ? THEME_COLORS.dark.text : THEME_COLORS.light.text;
  };

  const calculateIntervalInSeconds = (tf: string): number => {
    const value = parseInt(tf.slice(0, -1)); const unit = tf.slice(-1).toLowerCase();
    if (unit === 'm') return value * 60; if (unit === 'h') return value * 3600;
    if (unit === 'd') return value * 86400; if (unit === 'w') return value * 604800;
    return 3600;
  };

  useEffect(() => {
    const chartEl = chartContainerRef.current;
    if (!chartEl || !formattedSymbol || !providerConf) {
      onChartLoadingStateChange(false);
      return;
    }

    onChartLoadingStateChange(true); setTickerData(null);
    onLatestChartInfoUpdate({ price: null, volume: null }); // RSI removed
    setHistoricalData([]); maSeriesRefs.current = {};
    setCurrentIntervalInSeconds(calculateIntervalInSeconds(apiTimeframe));

    volumePriceScaleIdRef.current = null;
    // rsiPriceScaleIdRef.current = null; // RSI removed

    // const volumePaneIndex = 1; // Volume is now always pane 1 (main chart is pane 0)
    // rsiPaneIndex removed

    const effectiveBackgroundColor = chartPaneBackgroundColor || (theme === 'dark' ? THEME_COLORS.dark.background : THEME_COLORS.light.background);
    // Determine text color based on the *actual* background color of the chart pane
    const scaleTextColor = isColorLight(effectiveBackgroundColor) ? THEME_COLORS.light.text : THEME_COLORS.dark.text;
    const generalLayoutTextColor = scaleTextColor; // Use the same for general layout text for consistency

    const gridColor = theme === 'dark' ? THEME_COLORS.dark.grid : THEME_COLORS.light.grid;
    const borderColor = theme === 'dark' ? THEME_COLORS.dark.border : THEME_COLORS.light.border;

    // Base options: layout.textColor is general, specific scales will be overridden.
    const chartBaseOptions: DeepPartial<ChartOptions> = {
      ...getChartLayoutOptions(effectiveBackgroundColor, generalLayoutTextColor, gridColor, borderColor),
      autoSize: true,
      // Time scale and price scale options will be applied more explicitly below
      timeScale: {
        timeVisible: true,
        secondsVisible: apiTimeframe.includes('m'),
        // borderColor and textColor will be set by applyScaleStyles
      },
      rightPriceScale: {
        mode: PriceScaleMode.Logarithmic,
        // borderColor and textColor will be set by applyScaleStyles
        scaleMargins: { top: 0.1, bottom: 0.05 },
      },
    };

    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    chartRef.current = createChart(chartEl, chartBaseOptions);

    const candlestickOptions: DeepPartial<CandlestickSeriesOptions> = {
      upColor: '#22C55E', downColor: '#EF4444', borderDownColor: '#EF4444', borderUpColor: '#22C55E',
      wickDownColor: '#EF4444', wickUpColor: '#22C55E', // pane: 0 // Removed 'pane'
    };
    candlestickSeriesRef.current = (chartRef.current as any).addCandlestickSeries(candlestickOptions);

    // Projection series removed - eliminar línea de proyección azul discontinua
    // const projectionOptions: DeepPartial<LineSeriesOptions> = {
    //    color: '#0ea5e9', lineWidth: 2, lineStyle: LineStyle.Dashed, lastValueVisible: false, priceLineVisible: false, // pane: 0 // Removed 'pane'
    // };
    // projectionSeriesRef.current = (chartRef.current as any).addLineSeries(projectionOptions);


    volumeSeriesRef.current = null;
    if (chartRef.current) {
      const id = `volume_ps_1`; // Assuming volume is on pane 1, though 'pane' property was removed
      volumePriceScaleIdRef.current = id;
      const volumeOptions: DeepPartial<HistogramSeriesOptions> = {
        priceFormat: { type: 'volume' },
        // pane: volumePaneIndex, // Removed 'pane'
        priceScaleId: id,
      };
      volumeSeriesRef.current = (chartRef.current as any).addHistogramSeries(volumeOptions);

      // Volume scale margins and other non-color options
      chartRef.current.priceScale(id).applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
    }

    // RSI series and band lines creation removed

    // Centralized function to apply styles to all relevant scales
    const applyScaleStyles = (chart: IChartApi, txtColor: string, brdColor: string) => {
      // Right Price Scale (Main)
      chart.priceScale('right').applyOptions({
        textColor: txtColor,
        borderColor: brdColor,
      });

      // Time Scale (Bottom)
      chart.timeScale().applyOptions({
        // textColor: txtColor, // Removed textColor due to HorzScaleOptions error
        borderColor: brdColor,
      });

      // Volume Price Scale
      if (volumePriceScaleIdRef.current) {
        chart.priceScale(volumePriceScaleIdRef.current).applyOptions({
          // textColor: txtColor, // Already commented out
          borderColor: brdColor,
        });
      }
      // Any other scales (e.g., for RSI if it were present) would go here
    };

    if (chartRef.current) {
      applyScaleStyles(chartRef.current, scaleTextColor, borderColor);
    }

    // Fetch historical data
    const fetchHistoricalData = async () => {
      const apiUrl = providerConf.historicalApi(formattedSymbol, apiTimeframe);
      try {
        console.log(`Fetching historical data from: ${apiUrl}`);
        const response = await fetch(apiUrl);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`HTTP error! status: ${response.status}, URL: ${apiUrl}, Response: ${errorText}`);
          throw new Error(`HTTP error! status: ${response.status}, Response: ${errorText}`);
        }
        const rawData = await response.json();
        const parsedData = providerConf.parseHistorical(rawData);

        // Sort data just in case it's not strictly ordered (important for MAs)
        parsedData.sort((a, b) => a.time - b.time);
        setHistoricalData(parsedData);

        if (candlestickSeriesRef.current) candlestickSeriesRef.current.setData(parsedData);
        if (volumeSeriesRef.current) {
          const volumeData = parsedData.map(d => ({
            time: d.time,
            value: d.volume ?? 0,
            color: d.close > d.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
          }));
          volumeSeriesRef.current.setData(volumeData);
        }
        // RSI data calculation and setting removed

        if (parsedData.length > 0) {
          const lastPoint = parsedData[parsedData.length - 1];
          onLatestChartInfoUpdate({ price: lastPoint.close, volume: lastPoint.volume });
        }

      } catch (error) {
        console.error(`Failed to fetch historical data from ${apiUrl}:`, error);
        setConnectionStatus('error');
      } finally {
        onChartLoadingStateChange(false);
      }
    };
    fetchHistoricalData();

    // WebSocket connection
    let ws: WebSocket | null = null;
    const setupWebSocket = () => {
      if (providerConf.type === 'binance') {
        // The wsKline function in providerConf already handles lowercasing the symbol.
        ws = new WebSocket(providerConf.wsKline(formattedSymbol, apiTimeframe));
      } else if (providerConf.type === 'bingx') {
        ws = new WebSocket(providerConf.wsBase);
        ws.onopen = () => {
          ws?.send(providerConf.getKlineSubMessage(formattedSymbol, apiTimeframe));
        };
      }

      if (ws) {
        ws.onopen = () => { setConnectionStatus('ok'); console.log(`${providerConf.name} WebSocket connected for klines.`); };
        ws.onmessage = (event) => {
          try {
            let klineData;
            if (providerConf.type === 'bingx' && typeof event.data === "string" && event.data.includes("ping")) {
              ws?.send(event.data.replace("ping", "pong")); return;
            } else if (providerConf.type === 'bingx' && event.data instanceof Blob) {
              // BingX sends compressed binary data
              const reader = new FileReader();
              reader.onload = function () {
                try {
                  const result = pako.inflate(new Uint8Array(reader.result as ArrayBuffer), { to: 'string' });
                  const jsonData = JSON.parse(result);
                  if (jsonData && jsonData.dataType && jsonData.dataType.startsWith(`${formattedSymbol}@kline_`)) {
                    const kline = jsonData.data?.[0];
                    if (kline) {
                      const newCandle = { time: kline.T / 1000 as UTCTimestamp, open: parseFloat(kline.o), high: parseFloat(kline.h), low: parseFloat(kline.l), close: parseFloat(kline.c), volume: parseFloat(kline.v) };
                      candlestickSeriesRef.current?.update(newCandle);
                      volumeSeriesRef.current?.update({ time: newCandle.time, value: newCandle.volume ?? 0, color: newCandle.close > newCandle.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)' });
                      onLatestChartInfoUpdate({ price: newCandle.close, volume: newCandle.volume });
                      setHistoricalData(prev => { // Keep historical data updated for MA calcs
                        const newData = [...prev];
                        const lastBar = newData[newData.length - 1];
                        if (lastBar && lastBar.time === newCandle.time) {
                          newData[newData.length - 1] = newCandle;
                        } else {
                          newData.push(newCandle);
                        }
                        return newData;
                      });
                    }
                  }
                } catch (e) { console.error('Error processing BingX binary message:', e); }
              };
              reader.readAsArrayBuffer(event.data);
              return; // Processed async
            } else {
              const data = JSON.parse(event.data as string);
              if (providerConf.type === 'binance' && data.e === 'kline') {
                klineData = providerConf.parseKline(data);
              } else { return; } // Skip non-kline messages or other providers for now
            }

            if (klineData) {
              candlestickSeriesRef.current?.update(klineData);
              volumeSeriesRef.current?.update({ time: klineData.time, value: klineData.volume ?? 0, color: klineData.close > klineData.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)' });
              onLatestChartInfoUpdate({ price: klineData.close, volume: klineData.volume });
              setHistoricalData(prev => { // Keep historical data updated for MA calcs
                const newData = [...prev];
                const lastBar = newData[newData.length - 1];
                if (lastBar && lastBar.time === klineData!.time) {
                  newData[newData.length - 1] = klineData!;
                } else {
                  newData.push(klineData!);
                }
                return newData;
              });
            }
          } catch (e) { console.error('Error processing WebSocket kline message:', e); }
        };
        ws.onerror = (event: Event) => { // Changed 'error' to 'event' and typed it
          console.error(`${providerConf.name} WebSocket error event type:`, event.type);
          console.error(`${providerConf.name} WebSocket error object:`, event);
          setConnectionStatus('error');
        };
        ws.onclose = (event: WebSocketCloseEvent) => { // Typed the event as WebSocketCloseEvent (or standard CloseEvent if more general)
          console.log(`${providerConf.name} WebSocket disconnected. Code: ${event.code}, Reason: "${event.reason}", Clean: ${event.wasClean}`);
          setConnectionStatus('connecting');
        };
      }
    };
    setupWebSocket();

    return () => {
      ws?.close();
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [
    dataSource, rawSymbol, rawTimeframe, /* Dependencies for chart recreation */
    theme, chartPaneBackgroundColor, /* Dependencies for styling changes */
    // Note: providerConf, formattedSymbol, apiTimeframe are derived and will change if their sources change.
    // Callbacks onLatestChartInfoUpdate, onChartLoadingStateChange are stable.
  ]);


  // Effect for updating MAs
  useEffect(() => {
    if (!chartRef.current || historicalData.length === 0) return;

    // Clear old MAs
    Object.values(maSeriesRefs.current).forEach(series => (chartRef.current as any)?.removeSeries(series));
    maSeriesRefs.current = {};

    movingAverages.forEach(maConfig => {
      if (maConfig.visible && historicalData.length >= maConfig.period) {
        const maData = maConfig.type === 'EMA'
          ? calculateEMA(historicalData, maConfig.period)
          : calculateMA(historicalData, maConfig.period);

        if (chartRef.current) {
          const maLineOptions: DeepPartial<LineSeriesOptions> = {
            color: maConfig.color,
            lineWidth: 1,
            lastValueVisible: false,
            priceLineVisible: false,
            // pane: 0, // Removed 'pane'
          };
          const maSeries = (chartRef.current as any).addLineSeries(maLineOptions);
          maSeries.setData(maData);
          maSeriesRefs.current[maConfig.id] = maSeries;
        }
      }
    });
  }, [movingAverages, historicalData]); // Re-run if MAs config or historical data changes

  // Effect for drawing analysis results
  useEffect(() => {
    if (!chartRef.current) return;

    // Clear previous analysis drawings
    analysisPriceLinesRef.current.forEach(line => candlestickSeriesRef.current?.removePriceLine(line));
    analysisPriceLinesRef.current = [];
    // candlestickSeriesRef.current?.setMarkers([]); // Removed due to linter error
    // projectionSeriesRef.current?.setData([]); // Clear projection path - eliminado

    if (analysisResult && showAiAnalysisDrawings && candlestickSeriesRef.current) {
      const { puntos_clave_grafico, analisis_fibonacci } = analysisResult;
      // proyeccion_precio_visual eliminado - ya no se usa
      const currentSeries = candlestickSeriesRef.current;
      const markers: SeriesMarker<Time>[] = []; // This will be unused if setMarkers is removed

      // Draw price lines for levels and zones
      puntos_clave_grafico?.forEach(point => {
        const color = getStrokeColor(point.tipo);
        // const textColor = getTextColorForZone(color); // Not directly used for price lines/markers, but useful for custom HTML markers

        if (point.nivel != null) {
          const line = currentSeries.createPriceLine({ price: point.nivel, color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: point.label });
          analysisPriceLinesRef.current.push(line);
        } else if (point.zona) {
          const [minPrice, maxPrice] = point.zona;
          const isFvg = point.tipo === AnalysisPointType.FVG_ALCISTA || point.tipo === AnalysisPointType.FVG_BAJISTA;
          const zoneColor = getStrokeColor(point.tipo, isFvg);

          const lineTop = currentSeries.createPriceLine({ price: maxPrice, color: zoneColor, lineWidth: isFvg ? 3 : 1, lineStyle: isFvg ? LineStyle.Solid : LineStyle.Dotted, axisLabelVisible: true, title: `${point.label} (H)` });
          const lineBottom = currentSeries.createPriceLine({ price: minPrice, color: zoneColor, lineWidth: isFvg ? 3 : 1, lineStyle: isFvg ? LineStyle.Solid : LineStyle.Dotted, axisLabelVisible: true, title: `${point.label} (L)` });
          analysisPriceLinesRef.current.push(lineTop, lineBottom);
        }

        // Handle W-Signal markers (Code kept for logic, but markers won't be set due to setMarkers removal)
        if (showWSignals && (point.tipo === AnalysisPointType.AI_W_SIGNAL_BULLISH || point.tipo === AnalysisPointType.AI_W_SIGNAL_BEARISH)) {
          if (point.marker_time && point.marker_position && point.marker_shape) {
            const r = parseInt(wSignalColor.slice(1, 3), 16);
            const g = parseInt(wSignalColor.slice(3, 5), 16);
            const b = parseInt(wSignalColor.slice(5, 7), 16);
            const markerColorWithOpacity = `rgba(${r}, ${g}, ${b}, ${wSignalOpacity})`; // wSignalOpacity is already 0-1

            // This marker would be added to 'markers' array, but setMarkers is removed
            /*
            markers.push({
                time: point.marker_time as UTCTimestamp,
                position: point.marker_position,
                color: markerColorWithOpacity,
                shape: point.marker_shape as SeriesMarkerShape, // Cast if types.ts is fixed
                text: point.marker_text || 'W',
            });
            */
          }
        }
        // Handle other general markers (Code kept for logic, but markers won't be set)
        else if (point.marker_time && point.marker_position && point.marker_shape) {
          let markerColor = '#FFA500'; // Default marker color (Orange) for non-W signals
          let generalMarkerOpacity = 0.7; // Default opacity for other markers

          if (point.tipo === AnalysisPointType.ENTRADA_LARGO) {
            markerColor = `rgba(34, 197, 94, ${generalMarkerOpacity})`;
          } else if (point.tipo === AnalysisPointType.ENTRADA_CORTO) {
            markerColor = `rgba(239, 68, 68, ${generalMarkerOpacity})`;
          } else if (point.marker_shape === "arrowUp") {
            markerColor = `rgba(76, 175, 80, ${generalMarkerOpacity})`;
          } else if (point.marker_shape === "arrowDown") {
            markerColor = `rgba(244, 67, 54, ${generalMarkerOpacity})`;
          }
          // This marker would be added to 'markers' array, but setMarkers is removed
          /*
          markers.push({
              time: point.marker_time as UTCTimestamp,
              position: point.marker_position,
              color: markerColor,
              shape: point.marker_shape as SeriesMarkerShape, // Cast if types.ts is fixed
              text: point.marker_text || '',
          });
          */
        }
      });
      // currentSeries.setMarkers(markers); // Removed due to linter error

      // Draw Fibonacci levels with enhanced visualization
      if (analisis_fibonacci) {
        const { htf, ltf, niveles_retroceso, niveles_extension } = analisis_fibonacci;
        const fiboColors = theme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light;

        const drawFiboLevels = (levels: FibonacciLevel[], fiboColor: string, prefix: string = "", isExtension: boolean = false) => {
          levels.forEach(level => {
            // Enhanced line style based on Fibonacci level importance
            let lineWidth: 1 | 2 | 3 | 4 = 1; // Explicit type annotation
            let lineStyle = LineStyle.Dashed;

            // Golden ratio levels (0.618, 1.618) get special treatment
            if (level.level === 0.618 || level.level === 1.618) {
              lineWidth = 3;
              lineStyle = LineStyle.Solid;
            }
            // Major levels (0.5, 1.0) get medium thickness
            else if (level.level === 0.5 || level.level === 1.0) {
              lineWidth = 2;
              lineStyle = LineStyle.Solid;
            }
            // Extension levels get dotted style for differentiation
            else if (isExtension) {
              lineStyle = LineStyle.Dotted;
            }

            const line = currentSeries.createPriceLine({
              price: level.price,
              color: fiboColor,
              lineWidth: lineWidth,
              lineStyle: lineStyle,
              axisLabelVisible: true,
              title: `${prefix}${level.label} (${level.price.toFixed(2)})`
            });
            analysisPriceLinesRef.current.push(line);
          });
        };

        // 🔥 NUEVO: Soporte para formato htf/ltf moderno
        // Verificar si existen niveles en formato legacy (para compatibilidad)
        if (niveles_retroceso || niveles_extension) {
          if (niveles_retroceso) drawFiboLevels(niveles_retroceso, fiboColors.fiboRetracement, "Fib ", false);
          if (niveles_extension) drawFiboLevels(niveles_extension, fiboColors.fiboExtension, "Ext ", true);
        }

        // 🔥 NUEVO: Soporte para formato htf/ltf moderno
        // Mostrar análisis HTF (temporalidad alta) si está disponible
        if (htf) {
          // Se pueden agregar líneas para indicar puntos clave del impulso HTF
          // Por simplicidad, visualizamos solo los puntos de inicio y fin del impulso HTF
          if (htf.precio_inicio_impulso && htf.precio_fin_impulso) {
            const htfStartLine = currentSeries.createPriceLine({
              price: htf.precio_inicio_impulso,
              color: theme === 'dark' ? '#FFA500' : '#FF8C00', // Orange
              lineWidth: 2,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `HTF Inicio Impulso (${htf.precio_inicio_impulso.toFixed(2)})`
            });
            analysisPriceLinesRef.current.push(htfStartLine);

            const htfEndLine = currentSeries.createPriceLine({
              price: htf.precio_fin_impulso,
              color: theme === 'dark' ? '#FFA500' : '#FF8C00', // Orange
              lineWidth: 2,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `HTF Fin Impulso (${htf.precio_fin_impulso.toFixed(2)})`
            });
            analysisPriceLinesRef.current.push(htfEndLine);
          }
        }

        // Mostrar análisis LTF (temporalidad actual) si está disponible
        if (ltf) {
          // Visualizar puntos clave del análisis LTF
          if (ltf.precio_inicio_impulso && ltf.precio_fin_impulso) {
            const ltfStartLine = currentSeries.createPriceLine({
              price: ltf.precio_inicio_impulso,
              color: theme === 'dark' ? '#00CED1' : '#008B8B', // DarkTurquoise
              lineWidth: 2,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: true,
              title: `LTF Inicio Impulso (${ltf.precio_inicio_impulso.toFixed(2)})`
            });
            analysisPriceLinesRef.current.push(ltfStartLine);

            const ltfEndLine = currentSeries.createPriceLine({
              price: ltf.precio_fin_impulso,
              color: theme === 'dark' ? '#00CED1' : '#008B8B', // DarkTurquoise
              lineWidth: 2,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: true,
              title: `LTF Fin Impulso (${ltf.precio_fin_impulso.toFixed(2)})`
            });
            analysisPriceLinesRef.current.push(ltfEndLine);

            // Si hay precio de fin de retroceso, también mostrarlo
            if (ltf.precio_fin_retroceso) {
              const ltfRetracementLine = currentSeries.createPriceLine({
                price: ltf.precio_fin_retroceso,
                color: theme === 'dark' ? '#FFB6C1' : '#FF69B4', // LightPink/HotPink
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: true,
                title: `LTF Fin Retroceso (${ltf.precio_fin_retroceso.toFixed(2)})`
              });
              analysisPriceLinesRef.current.push(ltfRetracementLine);
            }
          }
        }
      }


      // Draw projection path if available - ELIMINADO
      // if (proyeccion_precio_visual?.camino_probable_1 && historicalData.length > 0) {
      //   const lastTime = historicalData[historicalData.length - 1].time;
      //   const projectionData: LineData[] = proyeccion_precio_visual.camino_probable_1.map((price, index) => ({
      //     time: (lastTime + (index * currentIntervalInSeconds)) as UTCTimestamp, // Approximate time for future points
      //     value: price,
      //   }));
      //   projectionSeriesRef.current?.setData(projectionData);
      // }
    }
  }, [analysisResult, showAiAnalysisDrawings, historicalData, currentIntervalInSeconds, theme, wSignalColor, wSignalOpacity, showWSignals]); // Redraw if result, visibility, data, or W-Signal style/visibility changes

  // Effect for managing pane heights (only volume now)
  useEffect(() => {
    if (chartRef.current && volumeSeriesRef.current && volumePriceScaleIdRef.current) {
      const chart = chartRef.current;
      // const totalHeight = chartContainerRef.current?.clientHeight ?? 600; // Fallback height

      // const minChartPaneHeight = 200; // Minimum height for the main price chart
      // let newVolumePaneHeight = volumePaneHeight;

      // Ensure main chart pane has enough space
      // if (totalHeight - newVolumePaneHeight < minChartPaneHeight) {
      //     newVolumePaneHeight = Math.max(0, totalHeight - minChartPaneHeight);
      // }


      if (volumePriceScaleIdRef.current) { // Ensure ID is not null
        // The 'height' property is not valid for applyOptions on a price scale.
        // Pane height is generally managed by the chart's overall layout or
        // by properties on the series itself if 'pane' is used to create a new pane.
        // Since volumePaneHeight is a prop, we'd typically adjust the chart layout
        // configuration when the chart is created or updated, or adjust the
        // container sizes. For simplicity, if volumePaneHeight is meant to control
        // the *visibility* or *relative size*, that logic would be more complex and
        // involve re-configuring the chart's pane structure or series options.
        // For now, we'll only control visibility based on a zero height.
        chart.priceScale(volumePriceScaleIdRef.current).applyOptions({
          // height: newVolumePaneHeight > 0 ? newVolumePaneHeight : undefined, // Invalid property
          visible: volumePaneHeight > 0
        });
      }

    }
  }, [volumePaneHeight, chartRef, volumeSeriesRef, volumePriceScaleIdRef, chartContainerRef]); // Removed dependencies related to RSI, added missing refs

  // 📝 Paso 2: useEffect para enviar los datos históricos hacia arriba
  useEffect(() => {
    if (historicalData.length > 0 && onHistoricalDataUpdate) {
      // Convertir CandlestickData[] a MarketDataPoint[]
      const marketDataPoints: MarketDataPoint[] = historicalData.map(candle => ({
        time: candle.time, // UTCTimestamp se convierte a number
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      }));

      onHistoricalDataUpdate(marketDataPoints);
    }
  }, [historicalData, onHistoricalDataUpdate]); // ¡Importante! El efecto depende de `historicalData`

  // Define WebSocketCloseEvent if not globally available or import if provided by a library
  interface WebSocketCloseEvent extends Event { // This is a standard Event, but can be augmented
    readonly code: number;
    readonly reason: string;
    readonly wasClean: boolean;
  }


  return (
    <div ref={chartContainerRef} className="w-full h-full relative">
      {connectionStatus === 'error' && <div className="absolute top-2 left-2 bg-red-500 text-white p-2 rounded text-xs z-10">Connection Error</div>}
    </div>
  );
};

export default RealTimeTradingChart;
