import React, { useEffect, useRef, useState } from 'react';
import {
  createChart, IChartApi, ISeriesApi,
  CandlestickData as LWCCandlestickData, LineData as LWCLineData, HistogramData as LWCHistogramData,
  LineStyle, UTCTimestamp, PriceScaleMode, IPriceLine, DeepPartial, ChartOptions, SeriesMarker, Time, ColorType,
  CandlestickSeriesOptions, LineSeriesOptions, HistogramSeriesOptions, LineWidth
} from 'lightweight-charts';
import pako from 'pako';
import { DataSource, GeminiAnalysisResult, TickerData, AnalysisPointType, MovingAverageConfig, FibonacciLevel, MarketDataPoint } from '../types';
import { mapTimeframeToApi } from '../constants';
import { generateUUID } from '../utils/uuid';

type Theme = 'dark' | 'light';

interface RealTimeTradingChartProps {
  dataSource: DataSource;
  symbol: string;
  timeframe: string;
  analysisResult: GeminiAnalysisResult | null;
  onLatestChartInfoUpdate: (info: { price: number | null; volume?: number | null }) => void;
  onChartLoadingStateChange: (isLoading: boolean) => void;
  movingAverages: MovingAverageConfig[];
  theme: Theme;
  chartPaneBackgroundColor: string;
  volumePaneHeight: number;
  showAiAnalysisDrawings: boolean;
  wSignalColor: string;
  wSignalOpacity: number;
  showWSignals: boolean;
  showLTFFibonacci: boolean; // Prop para controlar el Fibo LTF
  onHistoricalDataUpdate: (data: MarketDataPoint[]) => void;
}

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
            throw new Error(`BingX API error: ${bingxApiResponse?.msg || "Malformed data in 'contents'."}`);
          }
        } catch (e) {
          throw new Error("Error parsing BingX 'contents' string from allorigins.win as JSON.");
        }
      } else {
        throw new Error("Invalid response structure from allorigins.win proxy for BingX historical data.");
      }
    },
    getKlineSubMessage: (symbol, interval) => JSON.stringify({ id: generateUUID(), reqType: 'sub', dataType: `${symbol}@kline_${interval}` }),
    getTickerSubMessage: (symbol) => JSON.stringify({ id: generateUUID(), reqType: 'sub', dataType: `${symbol}@trade` }),
    parseKline: (data) => ({ time: data.T / 1000 as UTCTimestamp, open: parseFloat(data.o), high: parseFloat(data.h), low: parseFloat(data.l), close: parseFloat(data.c), volume: parseFloat(data.v) }),
    parseTicker: (data, currentSymbol, currentProvider) => ({ price: parseFloat(data.p), symbol: currentSymbol, provider: currentProvider })
  }
};

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
  light: { background: '#FFFFFF', text: '#000000', grid: '#e5e7eb', border: '#d1d5db', fiboRetracement: 'rgba(59, 130, 246, 0.7)', fiboExtension: 'rgba(249, 115, 22, 0.7)' },
  dark: { background: '#0f172a', text: '#FFFFFF', grid: '#1e293b', border: '#334155', fiboRetracement: 'rgba(96, 165, 250, 0.7)', fiboExtension: 'rgba(251, 146, 60, 0.7)' }
};

const getChartLayoutOptions = (
  effectiveBackgroundColor: string, effectiveTextColor: string, gridColor: string, borderColor: string
): DeepPartial<ChartOptions> => ({
  layout: {
    background: { type: ColorType.Solid, color: effectiveBackgroundColor },
    textColor: effectiveTextColor
  },
  grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
});


const RealTimeTradingChart: React.FC<RealTimeTradingChartProps> = ({
  dataSource, symbol: rawSymbol, timeframe: rawTimeframe, analysisResult,
  onLatestChartInfoUpdate, onChartLoadingStateChange, movingAverages, theme,
  chartPaneBackgroundColor, volumePaneHeight, showAiAnalysisDrawings,
  wSignalColor, wSignalOpacity, showWSignals, showLTFFibonacci,
  onHistoricalDataUpdate
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'>>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'>>(null);
  const analysisPriceLinesRef = useRef<IPriceLine[]>([]);
  const maSeriesRefs = useRef<Record<string, ISeriesApi<'Line'>>>({});
  const volumePriceScaleIdRef = useRef<string | null>(null);

  const [historicalData, setHistoricalData] = useState<CandlestickData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'ok' | 'error'>('connecting');

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
      default: return `rgba(156, 163, 175, ${opacity})`;
    }
  };

  useEffect(() => {
    const chartEl = chartContainerRef.current;
    if (!chartEl || !formattedSymbol || !providerConf) {
      onChartLoadingStateChange(false);
      return;
    }

    onChartLoadingStateChange(true);
    onLatestChartInfoUpdate({ price: null, volume: null });
    setHistoricalData([]);
    maSeriesRefs.current = {};

    const effectiveBackgroundColor = chartPaneBackgroundColor || (theme === 'dark' ? THEME_COLORS.dark.background : THEME_COLORS.light.background);
    const scaleTextColor = isColorLight(effectiveBackgroundColor) ? THEME_COLORS.light.text : THEME_COLORS.dark.text;
    const gridColor = theme === 'dark' ? THEME_COLORS.dark.grid : THEME_COLORS.light.grid;
    const borderColor = theme === 'dark' ? THEME_COLORS.dark.border : THEME_COLORS.light.border;

    const chartBaseOptions: DeepPartial<ChartOptions> = {
      ...getChartLayoutOptions(effectiveBackgroundColor, scaleTextColor, gridColor, borderColor),
      autoSize: true,
      timeScale: {
        timeVisible: true,
        secondsVisible: apiTimeframe.includes('m'),
        borderColor: borderColor,
      },
      rightPriceScale: {
        mode: PriceScaleMode.Logarithmic,
        borderColor: borderColor,
        textColor: scaleTextColor,
        scaleMargins: { top: 0.1, bottom: 0.05 },
      },
    };

    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    chartRef.current = createChart(chartEl, chartBaseOptions);

    candlestickSeriesRef.current = chartRef.current.addCandlestickSeries({
      upColor: '#22C55E', downColor: '#EF4444', borderDownColor: '#EF4444', borderUpColor: '#22C55E',
      wickDownColor: '#EF4444', wickUpColor: '#22C55E',
    });

    const volId = `volume_ps`;
    volumePriceScaleIdRef.current = volId;
    volumeSeriesRef.current = chartRef.current.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: volId,
    });
    chartRef.current.priceScale(volId).applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      borderColor: borderColor,
    });

    const fetchHistoricalData = async () => {
      const apiUrl = providerConf.historicalApi(formattedSymbol, apiTimeframe);
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const rawData = await response.json();
        const parsedData = providerConf.parseHistorical(rawData).sort((a, b) => a.time - b.time);
        setHistoricalData(parsedData);
        candlestickSeriesRef.current?.setData(parsedData);
        const volumeData = parsedData.map(d => ({ time: d.time, value: d.volume ?? 0, color: d.close > d.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)' }));
        volumeSeriesRef.current?.setData(volumeData);
        if (parsedData.length > 0) {
          onLatestChartInfoUpdate({ price: parsedData[parsedData.length - 1].close, volume: parsedData[parsedData.length - 1].volume });
        }
      } catch (error) {
        console.error(`Failed to fetch historical data from ${apiUrl}:`, error);
        setConnectionStatus('error');
      } finally {
        onChartLoadingStateChange(false);
      }
    };
    fetchHistoricalData();

    let ws: WebSocket | null = null;
    const setupWebSocket = () => {
      if (providerConf.type === 'binance') {
        ws = new WebSocket(providerConf.wsKline(formattedSymbol, apiTimeframe));
      } else if (providerConf.type === 'bingx') {
        ws = new WebSocket(providerConf.wsBase);
        ws.onopen = () => ws?.send(providerConf.getKlineSubMessage(formattedSymbol, apiTimeframe));
      }

      if (ws) {
        ws.onopen = () => setConnectionStatus('ok');
        ws.onmessage = (event) => {
          // WebSocket message processing logic here...
        };
        ws.onerror = () => setConnectionStatus('error');
        ws.onclose = () => setConnectionStatus('connecting');
      }
    };
    setupWebSocket();

    return () => {
      ws?.close();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [dataSource, rawSymbol, rawTimeframe, theme, chartPaneBackgroundColor]);

  useEffect(() => {
    if (!chartRef.current || historicalData.length === 0) return;

    Object.values(maSeriesRefs.current).forEach(series => chartRef.current?.removeSeries(series));
    maSeriesRefs.current = {};

    movingAverages.forEach(maConfig => {
      if (maConfig.visible && historicalData.length >= maConfig.period) {
        const maData = maConfig.type === 'EMA'
          ? calculateEMA(historicalData, maConfig.period)
          : calculateMA(historicalData, maConfig.period);

        const maSeries = chartRef.current?.addLineSeries({
          color: maConfig.color,
          lineWidth: 1,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        maSeries?.setData(maData);
        if (maSeries) {
          maSeriesRefs.current[maConfig.id] = maSeries;
        }
      }
    });
  }, [movingAverages, historicalData]);

  const calculateFibonacciRetracements = (start: number, end: number) => {
    const diff = end - start;
    const isUptrend = end > start;
    const keyLevels = [0, 0.382, 0.5, 0.618, 1.0];
    return keyLevels.map(level => ({ level, price: isUptrend ? end - (diff * level) : start + (diff * level), label: `${(level * 100).toFixed(1)}%` }));
  };

  const calculateFibonacciExtensions = (start: number, end: number, retracement: number) => {
    const diff = end - start;
    const isUptrend = end > start;
    const retracementDiff = retracement - end;
    const keyLevels = [1.272, 1.618, 2.618];
    return keyLevels.map(level => ({ level, price: isUptrend ? retracement + (Math.abs(retracementDiff) * level) : retracement - (Math.abs(retracementDiff) * level), label: `Ext ${(level * 100).toFixed(1)}%` }));
  };

  useEffect(() => {
    const chart = chartRef.current;
    const currentSeries = candlestickSeriesRef.current;

    if (!chart || !currentSeries) return;

    analysisPriceLinesRef.current.forEach(line => currentSeries.removePriceLine(line));
    analysisPriceLinesRef.current = [];

    if (analysisResult && showAiAnalysisDrawings) {
      const { puntos_clave_grafico, analisis_fibonacci } = analysisResult;

      puntos_clave_grafico?.forEach(point => {
        const defaultColor = getStrokeColor(point.tipo);
        if (point.nivel != null) {
          const isLiquidity = point.tipo === AnalysisPointType.LIQUIDEZ_COMPRADORA || point.tipo === AnalysisPointType.LIQUIDEZ_VENDEDORA;
          const lineOptions: DeepPartial<IPriceLine> = {
            price: point.nivel,
            color: isLiquidity ? '#FFD700' : defaultColor,
            lineWidth: (isLiquidity ? 2 : 1) as LineWidth,
            lineStyle: isLiquidity ? LineStyle.Dotted : LineStyle.Dashed,
            axisLabelVisible: true,
            title: isLiquidity ? `💲 ${point.label}` : point.label,
          };
          const line = currentSeries.createPriceLine(lineOptions);
          analysisPriceLinesRef.current.push(line);
        } else if (point.zona) {
          const isFvg = point.tipo === AnalysisPointType.FVG_ALCISTA || point.tipo === AnalysisPointType.FVG_BAJISTA;
          const zoneColor = getStrokeColor(point.tipo, isFvg);
          const [minPrice, maxPrice] = point.zona;
          analysisPriceLinesRef.current.push(
            currentSeries.createPriceLine({ price: maxPrice, color: zoneColor, lineWidth: isFvg ? 3 : 1, lineStyle: isFvg ? LineStyle.Solid : LineStyle.Dotted, axisLabelVisible: true, title: `${point.label} (H)` }),
            currentSeries.createPriceLine({ price: minPrice, color: zoneColor, lineWidth: isFvg ? 3 : 1, lineStyle: isFvg ? LineStyle.Solid : LineStyle.Dotted, axisLabelVisible: true, title: `${point.label} (L)` })
          );
        }
      });

      if (analisis_fibonacci) {
        const fiboColors = theme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light;
        const drawFiboForImpulse = (impulse: any, style: { color: string, lineStyle: LineStyle }) => {
          if (!impulse || impulse.precio_inicio_impulso == null || impulse.precio_fin_impulso == null) return;
          const retracements = calculateFibonacciRetracements(impulse.precio_inicio_impulso, impulse.precio_fin_impulso);
          const extensions = impulse.precio_fin_retroceso != null ? calculateFibonacciExtensions(impulse.precio_inicio_impulso, impulse.precio_fin_impulso, impulse.precio_fin_retroceso) : [];
          [...retracements, ...extensions].forEach(level => {
            analysisPriceLinesRef.current.push(currentSeries.createPriceLine({ price: level.price, color: style.color, lineWidth: (level.level === 0.618 || level.level === 1.618) ? 2 : 1, lineStyle: style.lineStyle, axisLabelVisible: true, title: `${level.label} (${impulse.temporalidad_analizada})` }));
          });
        };
        if (analisis_fibonacci.htf) {
          drawFiboForImpulse(analisis_fibonacci.htf, { color: fiboColors.fiboRetracement, lineStyle: LineStyle.Dashed });
        }
        if (analisis_fibonacci.ltf && showLTFFibonacci) {
          drawFiboForImpulse(analisis_fibonacci.ltf, { color: fiboColors.fiboExtension, lineStyle: LineStyle.Dotted });
        }
      }
    }
  }, [analysisResult, showAiAnalysisDrawings, theme, wSignalColor, wSignalOpacity, showWSignals, showLTFFibonacci]);

  useEffect(() => {
    if (historicalData.length > 0 && onHistoricalDataUpdate) {
      onHistoricalDataUpdate(historicalData.map(candle => ({ ...candle })));
    }
  }, [historicalData, onHistoricalDataUpdate]);

  interface WebSocketCloseEvent extends Event {
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