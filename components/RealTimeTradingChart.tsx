import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  createChart, IChartApi, ISeriesApi,
  CandlestickData as LWCCandlestickData,
  LineStyle, UTCTimestamp, IPriceLine, ColorType
} from 'lightweight-charts';
import { DataSource, GeminiAnalysisResult, MovingAverageConfig, MarketDataPoint } from '../types';
import { mapTimeframeToApi } from '../constants';
import { generateUUID } from '../utils/uuid';
import { calculateFibonacciRetracements } from '../utils/fibonacci';
import { calculateMA, calculateEMA } from '../utils/movingAverages';

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
  showAiAnalysisDrawings: boolean;
  showLTFFibonacci: boolean;
  onHistoricalDataUpdate: (data: MarketDataPoint[]) => void;
  showWSignals: boolean;
  wSignalColor: string;
  wSignalOpacity: number;
  signalsOpacity: number;
}

type CandlestickData = LWCCandlestickData<UTCTimestamp> & { volume?: number };

const isDataPointValid = (item: any): boolean => {
  return item &&
    typeof item.time === 'number' && !isNaN(item.time) && item.time > 0 &&
    typeof item.open === 'number' && !isNaN(item.open) &&
    typeof item.high === 'number' && !isNaN(item.high) &&
    typeof item.low === 'number' && !isNaN(item.low) &&
    typeof item.close === 'number' && !isNaN(item.close) &&
    (item.volume === undefined || (typeof item.volume === 'number' && !isNaN(item.volume)));
};

const PROVIDERS_CONFIG = {
  binance: {
    historicalApi: (symbol: string, interval: string) => `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=500`,
    wsKline: (symbol: string, interval: string) => `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@kline_${interval}`,
    parseHistorical: (data: any[]): CandlestickData[] => {
      if (!Array.isArray(data)) return [];
      return data
        .map((k: any) => ({
          time: Math.floor(Number(k?.[0]) / 1000) as UTCTimestamp,
          open: parseFloat(k?.[1]), high: parseFloat(k?.[2]),
          low: parseFloat(k?.[3]), close: parseFloat(k?.[4]),
          volume: parseFloat(k?.[5]),
        }))
        .filter(isDataPointValid).sort((a: CandlestickData, b: CandlestickData) => a.time - b.time);
    },
    parseKline: (data: any): CandlestickData | null => {
      const item = {
        time: Math.floor(Number(data?.k?.t) / 1000) as UTCTimestamp,
        open: parseFloat(data?.k?.o), high: parseFloat(data?.k?.h),
        low: parseFloat(data?.k?.l), close: parseFloat(data?.k?.c),
        volume: parseFloat(data?.k?.v)
      };
      return isDataPointValid(item) ? item : null;
    },
  },
  bingx: {
    historicalApi: (symbol: string, interval: string) => `https://api.allorigins.win/raw?url=https://open-api.bingx.com/openApi/swap/v2/quote/klines?symbol=${symbol}&interval=${interval}&limit=500`,
    wsBase: 'wss://open-api-swap.bingx.com/swap-market',
    getKlineSubMessage: (symbol: string, interval: string) => JSON.stringify({ id: generateUUID(), reqType: 'sub', dataType: `${symbol}@kline_${interval}` }),
    parseHistorical: (allOriginsParsedResponse: any): CandlestickData[] => {
      if (allOriginsParsedResponse && typeof allOriginsParsedResponse.contents === 'string') {
        try {
          const bingxApiResponse = JSON.parse(allOriginsParsedResponse.contents);
          if (bingxApiResponse && bingxApiResponse.code === "0" && Array.isArray(bingxApiResponse.data)) {
            return bingxApiResponse.data
              .map((k: any) => ({
                time: Math.floor(Number(k.time) / 1000) as UTCTimestamp,
                open: parseFloat(k.open), high: parseFloat(k.high),
                low: parseFloat(k.low), close: parseFloat(k.close),
                volume: parseFloat(k.volume)
              }))
              .filter(isDataPointValid)
              .sort((a: CandlestickData, b: CandlestickData) => a.time - b.time);
          }
        } catch (e) {
          console.error("Error parsing BingX JSON:", e);
        }
      }
      return [];
    },
    parseKline: (data: any): CandlestickData | null => {
      const item = {
        time: Math.floor(Number(data?.T) / 1000) as UTCTimestamp,
        open: parseFloat(data?.o), high: parseFloat(data?.h),
        low: parseFloat(data?.l), close: parseFloat(data?.c),
        volume: parseFloat(data?.v)
      };
      return isDataPointValid(item) ? item : null;
    }
  }
};

const THEME_COLORS = {
  light: { text: '#000000', grid: '#e5e7eb', fiboRetracement: 'rgba(59, 130, 246, 0.7)', fiboExtension: 'rgba(249, 115, 22, 0.7)' },
  dark: { text: '#FFFFFF', grid: '#1e293b', fiboRetracement: 'rgba(96, 165, 250, 0.7)', fiboExtension: 'rgba(251, 146, 60, 0.7)' }
};

// Función para convertir hex a RGBA con opacidad
const hexToRgba = (hex: string, opacity: number = 0.65): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Función para determinar colores de señales según especificaciones del usuario
const getSignalColor = (tipo: string, temporalidad: string = '', importancia: string = '', label: string = '', opacity: number = 0.65): string => {
  // Solo importancia alta se queda en amarillo
  if (importancia === 'alta') {
    return hexToRgba('#FFD700', opacity);
  }

  // Detectar tipo por label si no está en tipo
  const fullText = `${tipo} ${label}`.toLowerCase();

  // BOS y CHOCH en gris
  if (fullText.includes('bos') || fullText.includes('choch') ||
    tipo === 'bos_alcista' || tipo === 'bos_bajista' ||
    tipo === 'choch_alcista' || tipo === 'choch_bajista') {
    return hexToRgba('#6B7280', opacity);
  }

  // FVG en azul más oscuro que Fibonacci (diferentes tonos por temporalidad)
  if (fullText.includes('fvg') || tipo === 'fvg_alcista' || tipo === 'fvg_bajista') {
    switch (temporalidad?.toLowerCase()) {
      case '1m': case '5m': return hexToRgba('#1E3A8A', opacity); // Azul muy oscuro
      case '15m': case '30m': return hexToRgba('#1E40AF', opacity); // Azul oscuro
      case '1h': case '4h': return hexToRgba('#2563EB', opacity); // Azul medio oscuro
      case '1d': case '1w': return hexToRgba('#3B82F6', opacity); // Azul medio
      default: return hexToRgba('#1E40AF', opacity); // Azul oscuro por defecto
    }
  }

  // EQ en morado
  if (fullText.includes('eq') || fullText.includes('equilibrium') || tipo === 'equilibrium') {
    return hexToRgba('#7C3AED', opacity);
  }

  // BSL en verde (diferentes tonos por temporalidad)
  if (fullText.includes('bsl') || fullText.includes('buy_side') || fullText.includes('buy-side') ||
    tipo.includes('liquidez_compradora') || tipo === 'liquidez_compradora') {
    switch (temporalidad?.toLowerCase()) {
      case '1m': case '5m': return hexToRgba('#047857', opacity); // Verde muy oscuro
      case '15m': case '30m': return hexToRgba('#059669', opacity); // Verde oscuro
      case '1h': case '4h': return hexToRgba('#10B981', opacity); // Verde medio
      case '1d': case '1w': return hexToRgba('#22C55E', opacity); // Verde claro
      default: return hexToRgba('#10B981', opacity); // Verde medio por defecto
    }
  }

  // SSL en rojo (diferentes tonos por temporalidad)
  if (fullText.includes('ssl') || fullText.includes('sell_side') || fullText.includes('sell-side') ||
    tipo.includes('liquidez_vendedora') || tipo === 'liquidez_vendedora') {
    switch (temporalidad?.toLowerCase()) {
      case '1m': case '5m': return hexToRgba('#991B1B', opacity); // Rojo muy oscuro
      case '15m': case '30m': return hexToRgba('#B91C1C', opacity); // Rojo oscuro
      case '1h': case '4h': return hexToRgba('#DC2626', opacity); // Rojo medio
      case '1d': case '1w': return hexToRgba('#EF4444', opacity); // Rojo claro
      default: return hexToRgba('#DC2626', opacity); // Rojo medio por defecto
    }
  }

  // Colores por defecto para otros tipos
  if (fullText.includes('supply') || fullText.includes('oferta') || tipo === 'poi_oferta') {
    return hexToRgba('#DC2626', opacity);
  }
  if (fullText.includes('demand') || fullText.includes('demanda') || tipo === 'poi_demanda') {
    return hexToRgba('#16A34A', opacity);
  }

  // Color por defecto (gris para señales no clasificadas)
  return hexToRgba('#6B7280', opacity);
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

const RealTimeTradingChart: React.FC<RealTimeTradingChartProps> = ({
  dataSource, symbol, timeframe, analysisResult,
  onLatestChartInfoUpdate, onChartLoadingStateChange, movingAverages, theme,
  chartPaneBackgroundColor, showAiAnalysisDrawings, showLTFFibonacci,
  onHistoricalDataUpdate, showWSignals, wSignalColor, wSignalOpacity, signalsOpacity
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<{ main: ISeriesApi<'Candlestick'> | null; volume: ISeriesApi<'Histogram'> | null; ma: Map<string, ISeriesApi<'Line'>> }>({ main: null, volume: null, ma: new Map() });
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const markersRef = useRef<any[]>([]);
  const [historicalData, setHistoricalData] = useState<CandlestickData[]>([]);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiTimeframe = useMemo(() => mapTimeframeToApi(timeframe), [timeframe]);
  const providerConf = useMemo(() => PROVIDERS_CONFIG[dataSource], [dataSource]);

  useEffect(() => {
    const chartEl = chartContainerRef.current;
    if (!chartEl || !providerConf || !symbol) return;

    // Set loading states
    setIsInitializing(true);
    onChartLoadingStateChange(true);
    setHistoricalData([]);

    // Close existing WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clean up existing chart safely
    if (chartApiRef.current) {
      try {
        // Clear price lines and markers first
        priceLinesRef.current = [];
        markersRef.current = [];

        // Remove MA series
        seriesRef.current.ma.forEach((series, key) => {
          if (series) {
            try {
              chartApiRef.current?.removeSeries(series);
            } catch (error) {
              console.warn(`Error removing MA series ${key}:`, error);
            }
          }
        });
        seriesRef.current.ma.clear();

        // Remove the chart
        chartApiRef.current.remove();
      } catch (error) {
        console.warn('Error cleaning up chart:', error);
      }
      chartApiRef.current = null;
      seriesRef.current = { main: null, volume: null, ma: new Map() };
    }

    // Small delay to ensure cleanup is complete before creating new chart
    const initTimeout = setTimeout(() => {
      if (!chartEl) return; try {
        const chart = createChart(chartEl, {
          autoSize: true,
          layout: {
            background: { type: ColorType.Solid, color: theme === 'dark' ? '#0f172a' : '#FFFFFF' },
            textColor: theme === 'dark' ? '#FFFFFF' : '#000000'
          },
          grid: {
            vertLines: {
              color: theme === 'dark' ? 'rgba(51, 65, 85, 0.3)' : 'rgba(229, 231, 235, 0.5)',
              style: LineStyle.Solid,
              visible: true
            },
            horzLines: {
              color: theme === 'dark' ? 'rgba(51, 65, 85, 0.3)' : 'rgba(229, 231, 235, 0.5)',
              style: LineStyle.Solid,
              visible: true
            }
          }
        });

        chartApiRef.current = chart;

        seriesRef.current.main = chart.addCandlestickSeries({
          upColor: '#22C55E',
          downColor: '#EF4444',
          borderVisible: false,
          wickUpColor: '#22C55E',
          wickDownColor: '#EF4444'
        });

        seriesRef.current.volume = chart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: ''
        });
        seriesRef.current.volume.priceScale().applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 }
        });

        let isMounted = true;

        // Set a safety timeout
        loadingTimeoutRef.current = setTimeout(() => {
          if (isInitializing) {
            console.warn('Chart loading timeout - forcing completion');
            setIsInitializing(false);
            onChartLoadingStateChange(false);
          }
        }, 10000); // 10 second timeout

        // Fetch historical data
        fetch(providerConf.historicalApi(symbol, apiTimeframe))
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            if (!isMounted) return;

            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current);
              loadingTimeoutRef.current = null;
            }

            const parsedData = providerConf.parseHistorical(data);
            if (parsedData.length > 0) {
              setHistoricalData(parsedData);
              onHistoricalDataUpdate(parsedData);
              onLatestChartInfoUpdate({
                price: parsedData[parsedData.length - 1].close,
                volume: parsedData[parsedData.length - 1].volume
              });
            }
          })
          .catch(error => {
            console.error("Failed to fetch historical data:", error);
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current);
              loadingTimeoutRef.current = null;
            }
            // Don't leave the user with a blank screen - show an error state
            setHistoricalData([]);
          })
          .finally(() => {
            if (isMounted) {
              setIsInitializing(false);
              onChartLoadingStateChange(false);

              // Initialize WebSocket after data is loaded
              try {
                if (dataSource === 'binance' && 'wsKline' in providerConf) {
                  const ws = new WebSocket(providerConf.wsKline(symbol, apiTimeframe));
                  wsRef.current = ws;

                  ws.onopen = () => {
                    console.log('WebSocket connected');
                  };

                  ws.onmessage = (event) => {
                    try {
                      const message = JSON.parse(event.data);
                      const kline = providerConf.parseKline(message);
                      if (kline && seriesRef.current.main && seriesRef.current.volume) {
                        seriesRef.current.main.update(kline);
                        seriesRef.current.volume.update({
                          time: kline.time,
                          value: kline.volume ?? 0,
                          color: kline.close >= kline.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
                        });
                        onLatestChartInfoUpdate({ price: kline.close, volume: kline.volume });
                      }
                    } catch (error) {
                      console.error('Error processing WebSocket message:', error);
                    }
                  };

                  ws.onerror = (error) => {
                    console.error("WebSocket Error:", error);
                  };

                  ws.onclose = () => {
                    console.log('WebSocket disconnected');
                  };

                } else if (dataSource === 'bingx' && 'wsBase' in providerConf) {
                  const ws = new WebSocket(providerConf.wsBase);
                  wsRef.current = ws;

                  ws.onopen = () => {
                    console.log('BingX WebSocket connected');
                    if (ws && 'getKlineSubMessage' in providerConf) {
                      ws.send(providerConf.getKlineSubMessage(symbol, apiTimeframe));
                    }
                  };

                  ws.onmessage = (event) => {
                    try {
                      const message = JSON.parse(event.data);
                      const kline = providerConf.parseKline(message);
                      if (kline && seriesRef.current.main && seriesRef.current.volume) {
                        seriesRef.current.main.update(kline);
                        seriesRef.current.volume.update({
                          time: kline.time,
                          value: kline.volume ?? 0,
                          color: kline.close >= kline.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
                        });
                        onLatestChartInfoUpdate({ price: kline.close, volume: kline.volume });
                      }
                    } catch (error) {
                      console.error('Error processing BingX WebSocket message:', error);
                    }
                  };

                  ws.onerror = (error) => {
                    console.error("BingX WebSocket Error:", error);
                  };

                  ws.onclose = () => {
                    console.log('BingX WebSocket disconnected');
                  };
                }
              } catch (error) {
                console.error('Error initializing WebSocket:', error);
              }
            }
          });

        // Cleanup function for this effect
        return () => {
          isMounted = false;
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
        };

      } catch (error) {
        console.error('Error creating chart:', error);
        setIsInitializing(false);
        onChartLoadingStateChange(false);
      }
    }, 100); // Small delay to ensure DOM is ready

    // Cleanup function for the main effect
    return () => {
      clearTimeout(initTimeout);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      if (chartApiRef.current) {
        try {
          priceLinesRef.current = [];
          markersRef.current = [];
          seriesRef.current.ma.forEach((series, key) => {
            if (series) {
              try {
                chartApiRef.current?.removeSeries(series);
              } catch (error) {
                console.warn(`Error removing MA series ${key} on cleanup:`, error);
              }
            }
          });
          seriesRef.current.ma.clear();
          chartApiRef.current.remove();
        } catch (error) {
          console.warn('Error removing chart on cleanup:', error);
        }
        chartApiRef.current = null;
        seriesRef.current = { main: null, volume: null, ma: new Map() };
      }
    };
  }, [symbol, timeframe, dataSource, theme]);

  useEffect(() => {
    const chart = chartApiRef.current;
    if (!chart) return;

    const effectiveBgColor = chartPaneBackgroundColor || (theme === 'dark' ? '#0f172a' : '#FFFFFF');
    const textColor = isColorLight(effectiveBgColor) ? '#000000' : '#FFFFFF';
    const gridColor = theme === 'dark' ? '#1e293b' : '#e5e7eb';

    chart.applyOptions({
      layout: { background: { type: ColorType.Solid, color: effectiveBgColor }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
    });
  }, [theme, chartPaneBackgroundColor]);

  useEffect(() => {
    if (historicalData.length > 0 && seriesRef.current.main && seriesRef.current.volume) {
      seriesRef.current.main.setData(historicalData);
      const volumeData = historicalData.map(d => ({ time: d.time, value: d.volume ?? 0, color: d.close >= d.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)' }));
      seriesRef.current.volume.setData(volumeData);
    }
  }, [historicalData]);

  useEffect(() => {
    const chart = chartApiRef.current;
    const candlestickSeries = seriesRef.current.main;
    if (!chart || !candlestickSeries || historicalData.length === 0) return;

    // Safely remove existing MA series
    seriesRef.current.ma.forEach((series, key) => {
      if (series) {
        try {
          chart.removeSeries(series);
        } catch (error) {
          console.warn(`Error removing MA series ${key}:`, error);
        }
      }
    });
    seriesRef.current.ma.clear();

    movingAverages.forEach(ma => {
      if (ma.visible && historicalData.length >= ma.period) {
        const maData = ma.type === 'EMA' ? calculateEMA(historicalData, ma.period) : calculateMA(historicalData, ma.period);
        if (maData.length > 0) {
          const maSeries = chart.addLineSeries({
            color: ma.color,
            lineWidth: 1,
            lastValueVisible: false,
            priceLineVisible: false,
          });
          maSeries.setData(maData);
          seriesRef.current.ma.set(ma.id, maSeries);
        }
      }
    });
  }, [movingAverages, historicalData]);

  useEffect(() => {
    const candlestickSeries = seriesRef.current.main;
    if (!candlestickSeries) return;

    // Clear existing price lines and markers
    priceLinesRef.current.forEach(line => candlestickSeries.removePriceLine(line));
    priceLinesRef.current = [];
    markersRef.current = [];

    const drawLine = (price: number, options: any) => {
      const line = candlestickSeries.createPriceLine({
        price,
        ...options
      });
      priceLinesRef.current.push(line);
    };

    const drawZone = (minPrice: number, maxPrice: number, color: string, title?: string) => {
      // Draw zone as two horizontal lines
      drawLine(minPrice, {
        color: color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: title ? `${title} (Bottom)` : 'Zone Bottom',
      });
      drawLine(maxPrice, {
        color: color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: title ? `${title} (Top)` : 'Zone Top',
      });
    };

    const createMarker = (point: any, color: string, shape: any, position: any) => {
      if (point.marker_time && historicalData.length > 0) {
        return {
          time: point.marker_time as any,
          position: position,
          color: color,
          shape: shape,
          text: point.marker_text || point.label?.substring(0, 3) || '',
        };
      }
      return null;
    };

    if (analysisResult && showAiAnalysisDrawings) {
      const allMarkers: any[] = [];

      // 1. Puntos clave del gráfico
      analysisResult.puntos_clave_grafico?.forEach(point => {
        const opacity = signalsOpacity / 100; // Convertir de 0-100 a 0-1
        const color = getSignalColor(point.tipo || '', point.temporalidad || '', point.importancia || '', point.label || '', opacity);

        if (point.nivel != null) {
          drawLine(point.nivel, {
            color: color,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: point.label,
          });
        }
        if (point.zona) {
          drawZone(point.zona[0], point.zona[1], color, point.label);
        }
      });

      // 2. Liquidez Importante
      if (analysisResult.liquidez_importante) {
        const opacity = signalsOpacity / 100; // Convertir de 0-100 a 0-1

        // Buy-side liquidity (above old highs)
        analysisResult.liquidez_importante.buy_side?.forEach(point => {
          const color = getSignalColor('buy_side', point.temporalidad || '', point.importancia || '', point.label || '', opacity);

          if (point.nivel != null) {
            drawLine(point.nivel, {
              color: color,
              lineWidth: 2,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: true,
              title: `BSL: ${point.label}`,
            });
          }
          const marker = createMarker(point, color, 'arrowUp', 'belowBar');
          if (marker) allMarkers.push(marker);
        });

        // Sell-side liquidity (below old lows)
        analysisResult.liquidez_importante.sell_side?.forEach(point => {
          const color = getSignalColor('sell_side', point.temporalidad || '', point.importancia || '', point.label || '', opacity);

          if (point.nivel != null) {
            drawLine(point.nivel, {
              color: color,
              lineWidth: 2,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: true,
              title: `SSL: ${point.label}`,
            });
          }
          const marker = createMarker(point, color, 'arrowDown', 'aboveBar');
          if (marker) allMarkers.push(marker);
        });
      }

      // 3. Zonas Críticas de Oferta y Demanda
      if (analysisResult.zonas_criticas_oferta_demanda) {
        const opacity = signalsOpacity / 100; // Convertir de 0-100 a 0-1

        // Order Blocks de Oferta (Supply/Bearish OB)
        analysisResult.zonas_criticas_oferta_demanda.oferta_clave?.forEach(point => {
          const color = getSignalColor(point.tipo || 'oferta', point.temporalidad || '', point.importancia || '', point.label || '', opacity);

          if (point.zona) {
            drawZone(point.zona[0], point.zona[1], color, `OB Supply: ${point.label}`);
          } else if (point.nivel != null) {
            drawLine(point.nivel, {
              color: color,
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `Supply: ${point.label}`,
            });
          }
          const marker = createMarker(point, color, 'circle', 'aboveBar');
          if (marker) allMarkers.push(marker);
        });

        // Order Blocks de Demanda (Demand/Bullish OB)
        analysisResult.zonas_criticas_oferta_demanda.demanda_clave?.forEach(point => {
          const color = getSignalColor(point.tipo || 'demanda', point.temporalidad || '', point.importancia || '', point.label || '', opacity);

          if (point.zona) {
            drawZone(point.zona[0], point.zona[1], color, `OB Demand: ${point.label}`);
          } else if (point.nivel != null) {
            drawLine(point.nivel, {
              color: color,
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `Demand: ${point.label}`,
            });
          }
          const marker = createMarker(point, color, 'circle', 'belowBar');
          if (marker) allMarkers.push(marker);
        });

        // Fair Value Gaps (FVG)
        analysisResult.zonas_criticas_oferta_demanda.fvg_importantes?.forEach(point => {
          const color = getSignalColor('fvg', point.temporalidad || '', point.importancia || '', point.label || '', opacity);

          if (point.zona) {
            drawZone(point.zona[0], point.zona[1], color, `FVG: ${point.label}`);
          }
          const marker = createMarker(point, color, 'square', 'inBar');
          if (marker) allMarkers.push(marker);
        });
      }

      // 4. W-Signals específicas (si están habilitadas)
      if (showWSignals) {
        // Buscar señales W en todos los puntos
        const allPoints = [
          ...(analysisResult.puntos_clave_grafico || []),
          ...(analysisResult.liquidez_importante?.buy_side || []),
          ...(analysisResult.liquidez_importante?.sell_side || []),
          ...(analysisResult.zonas_criticas_oferta_demanda?.oferta_clave || []),
          ...(analysisResult.zonas_criticas_oferta_demanda?.demanda_clave || []),
          ...(analysisResult.zonas_criticas_oferta_demanda?.fvg_importantes || [])
        ];

        allPoints.forEach(point => {
          if (point.tipo?.includes('w_signal') || point.tipo?.includes('AI_W_SIGNAL')) {
            const isWBullish = point.tipo?.includes('bullish') || point.tipo?.includes('alcista');
            const marker = createMarker(
              point,
              wSignalColor,
              isWBullish ? 'arrowUp' : 'arrowDown',
              isWBullish ? 'belowBar' : 'aboveBar'
            );
            if (marker) {
              marker.text = 'W';
              // Apply opacity to W-Signal color
              marker.color = `${wSignalColor}${Math.round(wSignalOpacity * 255).toString(16).padStart(2, '0')}`;
              allMarkers.push(marker);
            }
          }
        });
      }

      // 5. Aplicar todos los marcadores
      if (allMarkers.length > 0) {
        candlestickSeries.setMarkers(allMarkers);
        markersRef.current = allMarkers;
      }

      // 6. Fibonacci Analysis
      if (analysisResult.analisis_fibonacci) {
        const { htf, ltf } = analysisResult.analisis_fibonacci;
        const fiboColors = theme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light;

        if (htf) {
          calculateFibonacciRetracements(htf.precio_inicio_impulso, htf.precio_fin_impulso)
            .forEach(level => drawLine(level.price, {
              color: fiboColors.fiboRetracement,
              lineStyle: LineStyle.Dotted,
              axisLabelVisible: true,
              title: `${level.label} HTF`
            }));
        }
        if (ltf && showLTFFibonacci) {
          calculateFibonacciRetracements(ltf.precio_inicio_impulso, ltf.precio_fin_impulso)
            .forEach(level => drawLine(level.price, {
              color: fiboColors.fiboExtension,
              lineStyle: LineStyle.Dotted,
              axisLabelVisible: true,
              title: `${level.label} LTF`
            }));
        }
      }
    }
  }, [analysisResult, showAiAnalysisDrawings, showLTFFibonacci, showWSignals, wSignalColor, theme, historicalData, signalsOpacity]);

  return (
    <div className="w-full h-full relative">
      <div ref={chartContainerRef} className="w-full h-full" />
      {(isInitializing || !historicalData.length) && (
        <div className={`absolute inset-0 flex items-center justify-center backdrop-blur-sm ${theme === 'dark' ? 'bg-slate-800/90' : 'bg-white/90'}`}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
            <p className={`text-lg font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
              {isInitializing ? 'Inicializando gráfico...' : 'Cargando datos...'}
            </p>
            <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              {symbol} • {timeframe.toUpperCase()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeTradingChart;