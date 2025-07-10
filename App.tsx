import React, { useState, useEffect, useCallback, useRef } from 'react';
import RealTimeTradingChart from './components/RealTimeTradingChart';
import AnalysisPanel from './components/AnalysisPanel';
import ApiKeyMessage from './components/ApiKeyMessage';
import DisplaySettingsDialog from './components/DisplaySettingsDialog';
import TemplateManager from './components/TemplateManager';
import { GeminiAnalysisResult, DataSource, MovingAverageConfig, MarketDataPoint, ChartTemplate } from './types';
import { analyzeChartWithGemini, ExtendedGeminiRequestPayload, getGeminiApiKey } from './services/geminiService';
import { DEFAULT_SYMBOL, DEFAULT_TIMEFRAME, DEFAULT_DATA_SOURCE, CHAT_SYSTEM_PROMPT_TEMPLATE, GEMINI_MODEL_NAME, AVAILABLE_DATA_SOURCES, AVAILABLE_SYMBOLS_BINANCE, AVAILABLE_SYMBOLS_BINGX, QUICK_SELECT_TIMEFRAMES, DEFAULT_FAVORITE_TIMEFRAMES } from './constants';
import { GoogleGenAI, Chat } from "@google/genai";
import { useTemplateManager, TemplateConfiguration } from './hooks/useTemplateManager';
import { generateUUID } from './utils/uuid';

function debounce<T extends (...args: any[]) => void>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

interface LatestChartInfo {
  price: number | null;
  volume?: number | null;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
}

type Theme = 'dark' | 'light';
export type AnalysisPanelMode = 'initial' | 'analysis' | 'chat';

const initialMAs: MovingAverageConfig[] = [
  { id: 'ma1', type: 'EMA', period: 12, color: '#34D399', visible: true },
  { id: 'ma2', type: 'EMA', period: 20, color: '#F472B6', visible: true },
  { id: 'ma3', type: 'MA', period: 50, color: '#CBD5E1', visible: true },
  { id: 'ma4', type: 'MA', period: 200, color: '#FF0000', visible: true },
];

const INITIAL_DARK_CHART_PANE_BACKGROUND_COLOR = '#18191B';
const INITIAL_LIGHT_CHART_PANE_BACKGROUND_COLOR = '#FFFFFF';
const INITIAL_VOLUME_PANE_HEIGHT = 0;
const INITIAL_W_SIGNAL_COLOR = '#243EA8';
const INITIAL_W_SIGNAL_OPACITY = 70;
const INITIAL_SHOW_W_SIGNALS = true;
const INITIAL_SIGNALS_OPACITY = 65; // 65% opacidad para señales de análisis

const getLocalStorageItem = <T,>(key: string, defaultValue: T): T => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      try {
        return JSON.parse(storedValue) as T;
      } catch (e) {
        return defaultValue;
      }
    }
  }
  return defaultValue;
};

const getConsistentSymbolForDataSource = (symbol: string, ds: DataSource): string => {
  let consistentSymbol = symbol.toUpperCase();
  if (ds === 'bingx') {
    if (consistentSymbol === 'BTCUSDT') return 'BTC-USDT';
    if (consistentSymbol === 'ETHUSDT') return 'ETH-USDT';
    if (consistentSymbol === 'SOLUSDT') return 'SOL-USDT';
  } else if (ds === 'binance') {
    if (consistentSymbol === 'BTC-USDT') return 'BTCUSDT';
    if (consistentSymbol === 'ETH-USDT') return 'ETHUSDT';
    if (consistentSymbol === 'SOL-USDT') return 'SOLUSDT';
  }
  return consistentSymbol;
};


const App: React.FC = () => {
  const initialRawSymbol = getLocalStorageItem('traderoad_actualSymbol', DEFAULT_SYMBOL);
  const initialDataSource = getLocalStorageItem('traderoad_dataSource', DEFAULT_DATA_SOURCE);
  const consistentInitialSymbol = getConsistentSymbolForDataSource(initialRawSymbol, initialDataSource);

  const [dataSource, setDataSource] = useState<DataSource>(initialDataSource);
  const [actualSymbol, setActualSymbol] = useState<string>(consistentInitialSymbol);
  const [symbolInput, setSymbolInput] = useState<string>(consistentInitialSymbol);
  const [timeframe, setTimeframe] = useState<string>(() => getLocalStorageItem('traderoad_timeframe', DEFAULT_TIMEFRAME));
  const [favoriteTimeframes, setFavoriteTimeframes] = useState<string[]>(() => {
    const savedFavorites = getLocalStorageItem('traderoad_favoriteTimeframes', DEFAULT_FAVORITE_TIMEFRAMES);
    // Ordenar favoritos según el orden definido en QUICK_SELECT_TIMEFRAMES
    return QUICK_SELECT_TIMEFRAMES.filter(tf => savedFavorites.includes(tf));
  });
  const [theme, setTheme] = useState<Theme>(() => getLocalStorageItem('traderoad_theme', 'dark'));
  const [movingAverages, setMovingAverages] = useState<MovingAverageConfig[]>(() => getLocalStorageItem('traderoad_movingAverages', initialMAs));
  const [showLTFFibonacci, setShowLTFFibonacci] = useState<boolean>(false);

  const initialBgColorBasedOnTheme = theme === 'dark' ? INITIAL_DARK_CHART_PANE_BACKGROUND_COLOR : INITIAL_LIGHT_CHART_PANE_BACKGROUND_COLOR;
  const [chartPaneBackgroundColor, setChartPaneBackgroundColor] = useState<string>(() => getLocalStorageItem('traderoad_chartPaneBackgroundColor', initialBgColorBasedOnTheme));
  const [volumePaneHeight, setVolumePaneHeight] = useState<number>(() => getLocalStorageItem('traderoad_volumePaneHeight', INITIAL_VOLUME_PANE_HEIGHT));
  const [showAiAnalysisDrawings, setShowAiAnalysisDrawings] = useState<boolean>(() => getLocalStorageItem('traderoad_showAiAnalysisDrawings', true));
  const [wSignalColor, setWSignalColor] = useState<string>(() => getLocalStorageItem('traderoad_wSignalColor', INITIAL_W_SIGNAL_COLOR));
  const [wSignalOpacity, setWSignalOpacity] = useState<number>(() => getLocalStorageItem('traderoad_wSignalOpacity', INITIAL_W_SIGNAL_OPACITY));
  const [showWSignals, setShowWSignals] = useState<boolean>(() => getLocalStorageItem('traderoad_showWSignals', INITIAL_SHOW_W_SIGNALS));
  const [signalsOpacity, setSignalsOpacity] = useState<number>(() => {
    const initialOpacity = getLocalStorageItem('traderoad_signalsOpacity', INITIAL_SIGNALS_OPACITY);
    return initialOpacity;
  });

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyPresent, setApiKeyPresent] = useState<boolean>(false);
  const [displaySettingsDialogOpen, setDisplaySettingsDialogOpen] = useState<boolean>(false);

  const [analysisResult, setAnalysisResult] = useState<GeminiAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [latestChartInfo, setLatestChartInfo] = useState<LatestChartInfo>({ price: null, volume: null });
  const [isChartLoading, setIsChartLoading] = useState<boolean>(true);

  const [analysisPanelMode, setAnalysisPanelMode] = useState<AnalysisPanelMode>('initial');
  const [isPanelVisible, setIsPanelVisible] = useState<boolean>(true);
  const [lastAnalysisClickTime, setLastAnalysisClickTime] = useState<number>(0);

  const templateManager = useTemplateManager();
  const [showTemplateManager, setShowTemplateManager] = useState<boolean>(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatSessionRef = useRef<Chat | null>(null);

  const [historicalData, setHistoricalData] = useState<MarketDataPoint[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('traderoad_dataSource', JSON.stringify(dataSource));
      localStorage.setItem('traderoad_actualSymbol', JSON.stringify(actualSymbol));
      localStorage.setItem('traderoad_timeframe', JSON.stringify(timeframe));
      localStorage.setItem('traderoad_favoriteTimeframes', JSON.stringify(favoriteTimeframes));
      localStorage.setItem('traderoad_theme', JSON.stringify(theme));
      localStorage.setItem('traderoad_movingAverages', JSON.stringify(movingAverages));
      localStorage.setItem('traderoad_chartPaneBackgroundColor', JSON.stringify(chartPaneBackgroundColor));
      localStorage.setItem('traderoad_volumePaneHeight', JSON.stringify(volumePaneHeight));
      localStorage.setItem('traderoad_showAiAnalysisDrawings', JSON.stringify(showAiAnalysisDrawings));
      localStorage.setItem('traderoad_wSignalColor', JSON.stringify(wSignalColor));
      localStorage.setItem('traderoad_wSignalOpacity', JSON.stringify(wSignalOpacity));
      localStorage.setItem('traderoad_showWSignals', JSON.stringify(showWSignals));
      localStorage.setItem('traderoad_signalsOpacity', JSON.stringify(signalsOpacity));
    }
  }, [
    dataSource, actualSymbol, timeframe, favoriteTimeframes, theme, movingAverages,
    chartPaneBackgroundColor, volumePaneHeight, showAiAnalysisDrawings,
    wSignalColor, wSignalOpacity, showWSignals, signalsOpacity
  ]);

  useEffect(() => {
    try {
      const keyFromEnv = getGeminiApiKey();
      setApiKey(keyFromEnv);
      setApiKeyPresent(true);
    } catch (error) {
      setApiKey(null);
      setApiKeyPresent(false);
      console.warn("Gemini API Key is not configured properly. AI analysis will be disabled.");
    }
  }, []);

  const getChatSystemPrompt = useCallback(() => {
    return CHAT_SYSTEM_PROMPT_TEMPLATE
      .replace('{{SYMBOL}}', actualSymbol.includes('-') ? actualSymbol.replace('-', '/') : (actualSymbol.endsWith('USDT') ? actualSymbol.replace(/USDT$/, '/USDT') : actualSymbol))
      .replace('{{TIMEFRAME}}', timeframe.toUpperCase());
  }, [actualSymbol, timeframe]);

  const initializeChatSession = useCallback(() => {
    if (apiKey && !chatLoading) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        chatSessionRef.current = ai.chats.create({
          model: GEMINI_MODEL_NAME,
          config: { systemInstruction: getChatSystemPrompt() },
        });
        setChatError(null);
      } catch (e: any) {
        console.error("Failed to initialize chat session:", e);
        setChatError(`Falló la inicialización del chat IA: ${e.message}.`);
        chatSessionRef.current = null;
      }
    }
  }, [apiKey, getChatSystemPrompt, chatLoading]);


  useEffect(() => {
    if (apiKeyPresent) {
      initializeChatSession();
    }
  }, [apiKeyPresent, initializeChatSession]);


  const debouncedSetActualSymbol = useCallback(
    debounce((newSymbol: string) => {
      const consistentTypedSymbol = getConsistentSymbolForDataSource(newSymbol.trim(), dataSource);
      setActualSymbol(consistentTypedSymbol);
      if (consistentTypedSymbol !== newSymbol.trim()) {
        setSymbolInput(consistentTypedSymbol);
      }
    }, 750),
    [dataSource]
  );

  const handleSymbolInputChange = (newInputValue: string) => {
    setSymbolInput(newInputValue.toUpperCase());
    debouncedSetActualSymbol(newInputValue.toUpperCase());
  };

  useEffect(() => {
    if (symbolInput !== actualSymbol) {
      setSymbolInput(actualSymbol);
    }
  }, [actualSymbol]);


  useEffect(() => {
    setAnalysisResult(null);
    setAnalysisError(null);
    setAnalysisPanelMode('initial');
  }, [actualSymbol, dataSource]);


  useEffect(() => {
    setLatestChartInfo({ price: null, volume: null });
  }, [actualSymbol, timeframe, dataSource]);

  useEffect(() => {
    const newThemeDefaultBgColor = theme === 'dark' ? INITIAL_DARK_CHART_PANE_BACKGROUND_COLOR : INITIAL_LIGHT_CHART_PANE_BACKGROUND_COLOR;
    const isCurrentBgThemeDefault =
      chartPaneBackgroundColor === INITIAL_DARK_CHART_PANE_BACKGROUND_COLOR ||
      chartPaneBackgroundColor === INITIAL_LIGHT_CHART_PANE_BACKGROUND_COLOR;

    if (isCurrentBgThemeDefault && chartPaneBackgroundColor !== newThemeDefaultBgColor) {
      setChartPaneBackgroundColor(newThemeDefaultBgColor);
    }
  }, [theme, chartPaneBackgroundColor]);

  // Guardar opacidad de señales en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('traderoad_signalsOpacity', JSON.stringify(signalsOpacity));
    }
  }, [signalsOpacity]);

  const handleLatestChartInfoUpdate = useCallback((info: LatestChartInfo) => setLatestChartInfo(info), []);
  const handleChartLoadingStateChange = useCallback((chartLoading: boolean) => setIsChartLoading(chartLoading), []);

  const handleHistoricalDataUpdate = useCallback((data: MarketDataPoint[]) => {
    setHistoricalData(data.slice(-200));
  }, []);

  const handleRequestAnalysis = useCallback(async (forceRegenerate: boolean = false) => {
    if (!apiKey) {
      setAnalysisError("Clave API no configurada. El análisis no puede proceder.");
      setAnalysisPanelMode('analysis');
      return;
    }
    if (isChartLoading || latestChartInfo.price === null || latestChartInfo.price === 0) {
      setAnalysisError("Datos del gráfico cargando o precio actual no disponible.");
      setAnalysisPanelMode('analysis');
      return;
    }

    const displaySymbolForAI = actualSymbol.includes('-') ? actualSymbol.replace('-', '/') : (actualSymbol.endsWith('USDT') ? actualSymbol.replace(/USDT$/, '/USDT') : actualSymbol);

    if (!forceRegenerate && analysisResult) {
      setAnalysisPanelMode('analysis');
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setAnalysisPanelMode('analysis');

    try {
      const payload: ExtendedGeminiRequestPayload = {
        symbol: displaySymbolForAI, timeframe: timeframe.toUpperCase(), currentPrice: latestChartInfo.price,
        marketContextPrompt: "Context will be generated by getFullAnalysisPrompt",
        latestVolume: latestChartInfo.volume, apiKey: apiKey
      };
      const result = await analyzeChartWithGemini(payload);
      setAnalysisResult(result);
      // Mostrar señales de IA por defecto después de hacer análisis
      setShowAiAnalysisDrawings(true);
      setShowWSignals(true);
    } catch (err) {
      let userErrorMessage = (err instanceof Error) ? err.message : "Ocurrió un error desconocido.";
      setAnalysisError(`${userErrorMessage} --- Revisa la consola para más detalles.`);
    } finally {
      setAnalysisLoading(false);
    }
  }, [apiKey, actualSymbol, timeframe, latestChartInfo, isChartLoading, analysisResult]);

  const handleShowChat = () => {
    setAnalysisPanelMode('chat');
    setChatError(null);
    if (!apiKeyPresent) {
      setChatError("Clave API no configurada. El Chat IA no está disponible.");
    } else if (!chatSessionRef.current) {
      initializeChatSession();
    }
  };

  const handleShowAnalysis = () => {
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastAnalysisClickTime;

    // Si no hay análisis o está cargando, hacer el análisis
    if (!analysisResult || analysisLoading) {
      setLastAnalysisClickTime(currentTime);
      handleRequestAnalysis();
      return;
    }

    // Si ya estamos en modo análisis y el usuario hace clic nuevamente
    // (dentro de un período razonable, por ejemplo 5 segundos), regenerar
    if (analysisPanelMode === 'analysis' && timeSinceLastClick < 5000) {
      setLastAnalysisClickTime(currentTime);
      handleRequestAnalysis(true); // Forzar regeneración
      return;
    }

    // En cualquier otro caso, solo mostrar el análisis existente
    setLastAnalysisClickTime(currentTime);
    setAnalysisPanelMode('analysis');
  };

  const handleSendMessageToChat = async (messageText: string) => {
    if (!messageText.trim() || chatLoading) return;

    if (!chatSessionRef.current) {
      setChatError("La sesión de chat no está inicializada. Intenta de nuevo.");
      initializeChatSession();
      return;
    }

    let userTextForAI = messageText.trim();
    const displaySymbolForAI = actualSymbol.includes('-') ? actualSymbol.replace('-', '/') : (actualSymbol.endsWith('USDT') ? actualSymbol.replace(/USDT$/, '/USDT') : actualSymbol);

    const chartContext = `--- CONTEXTO DEL GRÁFICO ACTUAL ---\nSímbolo: ${displaySymbolForAI}\nTemporalidad: ${timeframe.toUpperCase()}\nPrecio Actual: ${latestChartInfo.price ? `$${latestChartInfo.price.toFixed(Math.abs(latestChartInfo.price) < 1 ? 4 : 2)}` : 'N/A'}\nVolumen Última Vela: ${latestChartInfo.volume ? latestChartInfo.volume.toLocaleString() : 'N/A'}\nExchange: ${dataSource.toUpperCase()}\n\nEl usuario está viendo un gráfico de trading en tiempo real con las siguientes configuraciones:\n- Medias móviles activas: ${movingAverages.filter(ma => ma.visible).map(ma => `${ma.type}${ma.period}`).join(', ')}\n- Tema: ${theme}\n- Dibujos de análisis IA: ${showAiAnalysisDrawings ? 'Visibles' : 'Ocultos'}\n\nDATOS HISTÓRICOS DEL GRÁFICO (últimas ${historicalData.length} velas):\n${historicalData.length > 0 ? JSON.stringify(historicalData.slice(-50), null, 2) : 'No hay datos históricos disponibles aún'}\n--- FIN DEL CONTEXTO DEL GRÁFICO ---`;

    if (analysisResult && analysisResult.analisis_general?.simbolo === displaySymbolForAI) {
      const isMatchingTimeframe = analysisResult.analisis_general?.temporalidad_principal_analisis === timeframe.toUpperCase();
      let timeframeNote = "";
      if (!isMatchingTimeframe) {
        timeframeNote = `\n\n⚠️ NOTA IMPORTANTE PARA LA IA: El análisis técnico disponible fue generado para la temporalidad ${analysisResult.analisis_general?.temporalidad_principal_analisis || 'N/A'}, pero el usuario está viendo actualmente el gráfico en ${timeframe.toUpperCase()}. Considera esta diferencia en tu respuesta. El análisis sigue siendo válido como contexto, pero puedes mencionar que algunas observaciones podrían ser más relevantes en la temporalidad original del análisis.`;
      }
      userTextForAI = `--- INICIO DEL CONTEXTO DE ANÁLISIS ---\n${chartContext}\n\nANÁLISIS TÉCNICO PREVIO DISPONIBLE:\n${JSON.stringify(analysisResult, null, 2)}${timeframeNote}\n--- FIN DEL CONTEXTO DE ANÁLISIS ---\n\nPregunta del usuario: ${messageText.trim()}`;
    } else {
      userTextForAI = `${chartContext}\n\nPregunta del usuario: ${messageText.trim()}`;
    }

    const userMessage: ChatMessage = {
      id: generateUUID(),
      sender: 'user',
      text: messageText.trim(),
      timestamp: Date.now(),
    };
    setChatMessages((prevMessages) => [...prevMessages, userMessage]);
    setChatLoading(true);
    setChatError(null);

    try {
      const stream = await chatSessionRef.current.sendMessageStream({ message: userTextForAI });
      let currentAiMessageId = generateUUID();
      let accumulatedResponse = "";

      setChatMessages((prevMessages) => [
        ...prevMessages,
        { id: currentAiMessageId, sender: 'ai', text: "▋", timestamp: Date.now() },
      ]);

      for await (const chunk of stream) {
        accumulatedResponse += chunk.text;
        setChatMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === currentAiMessageId ? { ...msg, text: accumulatedResponse + "▋" } : msg
          )
        );
      }
      setChatMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === currentAiMessageId ? { ...msg, text: accumulatedResponse } : msg
        )
      );
    } catch (e: any) {
      console.error("Error sending message to Gemini Chat:", e);
      const errorMessage = `Falló la obtención de respuesta de la IA: ${e.message}`;
      setChatError(errorMessage);
      setChatMessages((prevMessages) => [
        ...prevMessages,
        { id: generateUUID(), sender: 'ai', text: `Error: ${e.message}`, timestamp: Date.now() },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearChatHistory = () => {
    setChatMessages([]);
    setChatError(null);
    if (apiKeyPresent) {
      initializeChatSession();
    }
  };

  const handleDataSourceChange = (newDataSource: DataSource) => {
    setDataSource(newDataSource);
    const symbolToConvert = symbolInput || actualSymbol;
    const consistentNewSymbol = getConsistentSymbolForDataSource(symbolToConvert, newDataSource);
    setActualSymbol(consistentNewSymbol);
    setSymbolInput(consistentNewSymbol);
  };

  const toggleAllMAsVisibility = (forceVisible?: boolean) => {
    const newVisibility = typeof forceVisible === 'boolean'
      ? forceVisible
      : !movingAverages.every(ma => ma.visible);
    setMovingAverages(prevMAs => prevMAs.map(ma => ({ ...ma, visible: newVisibility })));
  };

  const toggleTimeframeFavorite = (timeframe: string) => {
    setFavoriteTimeframes(prev => {
      let newFavorites;
      if (prev.includes(timeframe)) {
        newFavorites = prev.filter(tf => tf !== timeframe);
      } else {
        if (prev.length >= 8) {
          newFavorites = [...prev.slice(0, 7), timeframe];
        } else {
          newFavorites = [...prev, timeframe];
        }
      }

      // Ordenar favoritos según el orden definido en QUICK_SELECT_TIMEFRAMES
      const orderedFavorites = QUICK_SELECT_TIMEFRAMES.filter(tf => newFavorites.includes(tf));

      return orderedFavorites;
    });
  };

  const resetToDefaultFavorites = () => {
    setFavoriteTimeframes([...DEFAULT_FAVORITE_TIMEFRAMES]);
  };

  const getCurrentConfiguration = useCallback((): TemplateConfiguration => {
    return {
      movingAverages,
      theme,
      chartPaneBackgroundColor,
      volumePaneHeight,
      wSignalColor,
      wSignalOpacity,
      showWSignals,
      showAiAnalysisDrawings,
      favoriteTimeframes,
      defaultDataSource: dataSource,
      defaultSymbol: actualSymbol,
      defaultTimeframe: timeframe
    };
  }, [
    movingAverages, theme, chartPaneBackgroundColor, volumePaneHeight,
    wSignalColor, wSignalOpacity, showWSignals, showAiAnalysisDrawings,
    favoriteTimeframes, dataSource, actualSymbol, timeframe
  ]);

  const handleSaveTemplate = useCallback((template: Omit<ChartTemplate, 'id' | 'createdAt' | 'lastModified'>) => {
    templateManager.saveTemplate(template);
  }, [templateManager]);

  const handleLoadTemplate = useCallback((templateId: string) => {
    const config = templateManager.loadTemplate(templateId);
    if (config) {
      setMovingAverages(config.movingAverages);
      setTheme(config.theme);
      setChartPaneBackgroundColor(config.chartPaneBackgroundColor);
      setVolumePaneHeight(config.volumePaneHeight);
      setWSignalColor(config.wSignalColor);
      setWSignalOpacity(config.wSignalOpacity);
      setShowWSignals(config.showWSignals);
      setShowAiAnalysisDrawings(config.showAiAnalysisDrawings);
      setFavoriteTimeframes(config.favoriteTimeframes);
      if (config.defaultDataSource) setDataSource(config.defaultDataSource);
      if (config.defaultSymbol) {
        const consistentSymbol = getConsistentSymbolForDataSource(config.defaultSymbol, config.defaultDataSource || dataSource);
        setActualSymbol(consistentSymbol);
        setSymbolInput(consistentSymbol);
      }
      if (config.defaultTimeframe) setTimeframe(config.defaultTimeframe);
    }
  }, [templateManager, dataSource]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    templateManager.deleteTemplate(templateId);
  }, [templateManager]);

  const handleSetAsDefault = useCallback((templateId: string) => {
    templateManager.setAsDefault(templateId);
  }, [templateManager]);

  useEffect(() => {
    if (templateManager.activeTemplateId) {
      templateManager.updateActiveTemplate(getCurrentConfiguration());
    }
  }, [templateManager, getCurrentConfiguration]);

  return (
    <div className={`flex flex-col h-screen antialiased ${theme === 'dark' ? 'bg-slate-900 text-slate-100' : 'bg-gray-100 text-gray-900'}`}>
      <header className={`p-2 sm:p-3 shadow-md ${theme === 'dark' ? 'bg-slate-800' : 'bg-white border-b border-gray-200'}`}>
        <div className="lg:hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <img src="/logo blanco sin fondo.png" alt="TradinGuardIAn Logo" className="w-8 h-8" />
              <h1 className={`text-base sm:text-lg font-bold ${theme === 'dark' ? 'text-sky-400' : 'text-sky-600'}`}>
                TradinGuard<span className="text-white font-extrabold">IA</span>n
              </h1>
            </div>
            <div className="flex items-center gap-1">
              <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} title="Seleccionar Temporalidad" className={`text-xs px-2 py-1 h-8 rounded-lg border-0 focus:ring-2 ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}><optgroup label="Favoritos">{favoriteTimeframes.map(tf => (<option key={`fav-opt-${tf}`} value={tf}>{tf.toUpperCase()}</option>))}</optgroup><optgroup label="General">{QUICK_SELECT_TIMEFRAMES.filter(tf => !favoriteTimeframes.includes(tf)).map(tf => (<option key={tf} value={tf}>{tf.toUpperCase()}</option>))}</optgroup></select>
              <button onClick={() => toggleTimeframeFavorite(timeframe)} title="Añadir/Quitar Favorito" className={`p-2 h-8 w-8 flex items-center justify-center rounded text-xs ${favoriteTimeframes.includes(timeframe) ? 'bg-yellow-500 text-white' : (theme === 'dark' ? 'bg-slate-600' : 'bg-gray-200')}`}>{favoriteTimeframes.includes(timeframe) ? '★' : '☆'}</button>
              <button onClick={() => setIsPanelVisible(!isPanelVisible)} title="Mostrar/Ocultar Panel" className={`p-2 h-8 w-8 flex items-center justify-center rounded transition-colors ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d={isPanelVisible ? "M15 19l-7-7 7-7v14z" : "M9 5v14l11-7z"} /></svg></button>
              <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Cambiar Tema" className={`p-2 h-8 w-8 flex items-center justify-center rounded ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}>{theme === 'light' ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>}</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <select value={dataSource} onChange={(e) => handleDataSourceChange(e.target.value as DataSource)} className={`text-xs px-2 py-1.5 h-8 rounded border-0 focus:ring-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>{AVAILABLE_DATA_SOURCES.map(ds => <option key={ds.value} value={ds.value}>{ds.label}</option>)}</select>
            <select value={symbolInput} onChange={(e) => handleSymbolInputChange(e.target.value)} className={`text-xs px-2 py-1.5 h-8 rounded border-0 focus:ring-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>{(dataSource === 'bingx' ? AVAILABLE_SYMBOLS_BINGX : AVAILABLE_SYMBOLS_BINANCE).map(s => (<option key={s} value={s}>{s}</option>))}</select>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button onClick={handleShowAnalysis} disabled={analysisLoading || isChartLoading || !apiKeyPresent} className={`p-2 h-8 w-8 flex items-center justify-center rounded text-lg font-medium transition-colors ${apiKeyPresent && !analysisLoading && !isChartLoading ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-700 text-gray-400'}`}>⚡</button>
              <button onClick={handleShowChat} disabled={chatLoading || !apiKeyPresent} className={`p-2 h-8 w-8 flex items-center justify-center rounded text-lg font-medium transition-colors ${apiKeyPresent && !chatLoading ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-700 text-gray-400'}`}>🤖</button>
              <button onClick={() => setShowAiAnalysisDrawings(!showAiAnalysisDrawings)} title="Señales" className={`p-2 h-8 w-8 flex items-center justify-center rounded ${showAiAnalysisDrawings ? 'bg-orange-500 text-white' : 'bg-gray-600 text-white'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg></button>
              <button onClick={() => setShowLTFFibonacci(!showLTFFibonacci)} title="Fibonacci LTF" className={`p-2 h-8 w-8 flex items-center justify-center rounded ${showLTFFibonacci ? 'bg-teal-500 text-white' : 'bg-gray-600 text-white'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l-4 4m8-8v13l4-4" /></svg></button>
              <button onClick={() => setDisplaySettingsDialogOpen(true)} title="Indicadores" className={`p-2 h-8 w-8 flex items-center justify-center rounded transition-colors ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M7 12l3-3 4 4 5-5" /></svg></button>
              <button onClick={() => setShowTemplateManager(true)} title="Plantillas" className={`p-2 h-8 w-8 flex items-center justify-center rounded-lg ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z" /><path d="M8 21v-4a2 2 0 012-2h4a2 2 0 012 2v4" /><path d="M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" /></svg></button>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src="/logo blanco sin fondo.png" alt="TradinGuardIAn Logo" className="w-8 h-8" />
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-sky-400' : 'text-sky-600'}`}>
                TradinGuard<span className="text-white font-extrabold">IA</span>n
              </h1>
            </div>
            <select value={dataSource} onChange={(e) => handleDataSourceChange(e.target.value as DataSource)} className={`text-xs px-2 py-1 h-8 rounded border-0 focus:ring-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>{AVAILABLE_DATA_SOURCES.map(ds => <option key={ds.value} value={ds.value}>{ds.label}</option>)}</select>
            <div className="flex items-center gap-1">
              <select value={symbolInput} onChange={(e) => handleSymbolInputChange(e.target.value)} className={`text-xs px-2 py-1 h-8 w-24 rounded border-0 focus:ring-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>{(dataSource === 'bingx' ? AVAILABLE_SYMBOLS_BINGX : AVAILABLE_SYMBOLS_BINANCE).map(s => (<option key={s} value={s}>{s}</option>))}</select>
              <input type="text" value={symbolInput} onChange={(e) => handleSymbolInputChange(e.target.value)} placeholder="Otro..." className={`text-xs px-2 py-1 h-8 w-16 rounded border-0 focus:ring-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`} />
            </div>
            <div className="flex items-center gap-1">
              {favoriteTimeframes.map(tf => (<button key={tf} onClick={() => setTimeframe(tf)} onDoubleClick={() => toggleTimeframeFavorite(tf)} title={`${tf.toUpperCase()} - Doble click para quitar`} className={`h-8 text-xs px-2.5 py-1.5 rounded-lg transition-all duration-200 border ${timeframe === tf ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg' : theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'}`}><span className="font-medium">{tf.toUpperCase()}</span></button>))}
              <select value={timeframe} onChange={(e) => { if (e.target.value === 'RESET_FAVORITES') { resetToDefaultFavorites(); return; } setTimeframe(e.target.value); }} title="Seleccionar Temporalidad" className={`text-xs px-2 py-1 h-8 rounded-lg border-0 focus:ring-2 ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}><optgroup label="Favoritos">{favoriteTimeframes.map(tf => (<option key={`fav-opt-${tf}`} value={tf}>{tf.toUpperCase()}</option>))}</optgroup><optgroup label="General">{QUICK_SELECT_TIMEFRAMES.filter(tf => !favoriteTimeframes.includes(tf)).map(tf => (<option key={tf} value={tf}>{tf.toUpperCase()}</option>))}</optgroup><optgroup label="⚙️ Gestión"><option value="RESET_FAVORITES">🔄 Restaurar</option></optgroup></select>
              <button onClick={() => toggleTimeframeFavorite(timeframe)} title="Añadir/Quitar Favorito" className={`text-xs p-2 h-8 rounded ${favoriteTimeframes.includes(timeframe) ? 'bg-yellow-500 text-white' : (theme === 'dark' ? 'bg-slate-600' : 'bg-gray-200')}`}>{favoriteTimeframes.includes(timeframe) ? '★' : '☆'}</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsPanelVisible(!isPanelVisible)} title="Mostrar/Ocultar Panel" className={`p-2 h-8 w-8 flex items-center justify-center rounded-lg ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d={isPanelVisible ? "M15 19l-7-7 7-7v14z" : "M9 5v14l11-7z"} /></svg></button>
            <button onClick={handleShowAnalysis} title={analysisResult && analysisPanelMode === 'analysis' ? "Refrescar Análisis" : "Análisis IA"} className={`h-8 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md ${apiKeyPresent && !analysisLoading && !isChartLoading ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`} disabled={analysisLoading || isChartLoading || !apiKeyPresent}><span className="text-lg">⚡</span><span className="hidden xl:inline">{analysisLoading ? 'Analizando...' : (analysisResult && analysisPanelMode === 'analysis' ? 'Refrescar' : 'Análisis')}</span></button>
            <button onClick={handleShowChat} title="Chat IA" className={`h-8 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md ${apiKeyPresent && !chatLoading ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-400'}`} disabled={chatLoading || !apiKeyPresent}><span className="text-lg">🤖</span><span className="hidden lg:inline">Chat</span></button>
            <button onClick={() => setShowAiAnalysisDrawings(!showAiAnalysisDrawings)} title="Señales" className={`h-8 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md ${showAiAnalysisDrawings ? 'bg-orange-500 text-white' : 'bg-gray-600 text-white'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg><span className="hidden xl:inline">Señales</span></button>
            <button onClick={() => setShowLTFFibonacci(!showLTFFibonacci)} title="Fibonacci LTF" className={`h-8 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md ${showLTFFibonacci ? 'bg-teal-500 text-white' : 'bg-gray-600 text-white'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l-4 4m8-8v13l4-4" /></svg><span className="hidden xl:inline">Fib LTF</span></button>
            <button onClick={() => setDisplaySettingsDialogOpen(true)} title="Indicadores" className={`p-2 h-8 w-8 flex items-center justify-center rounded-lg ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M7 12l3-3 4 4 5-5" /></svg></button>
            <button onClick={() => setShowTemplateManager(true)} title="Plantillas" className={`p-2 h-8 w-8 flex items-center justify-center rounded-lg ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z" /><path d="M8 21v-4a2 2 0 012-2h4a2 2 0 012 2v4" /><path d="M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" /></svg></button>
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Tema" className={`p-2 h-8 w-8 flex items-center justify-center rounded-lg ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}>{theme === 'light' ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>}</button>
          </div>
        </div>
      </header>

      <ApiKeyMessage apiKeyPresent={apiKeyPresent} />

      <main className="flex-grow flex flex-col md:flex-row p-2 sm:p-4 gap-2 sm:gap-4 overflow-y-auto">
        <div id="controls-analysis-panel" className={`w-full md:w-80 lg:w-[360px] xl:w-[400px] flex-none flex-col gap-2 sm:gap-4 overflow-y-auto order-1 md:order-1 ${isPanelVisible ? (analysisPanelMode === 'initial' ? 'hidden md:flex' : 'flex') : 'hidden'}`}>
          <div className={`${theme === 'dark' ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow-md flex-grow flex flex-col`}>
            <AnalysisPanel
              panelMode={analysisPanelMode}
              analysisResult={analysisResult}
              analysisLoading={analysisLoading}
              analysisError={analysisError}
              chatMessages={chatMessages}
              chatLoading={chatLoading}
              chatError={chatError}
              onSendMessage={handleSendMessageToChat}
              onClearChatHistory={handleClearChatHistory}
              theme={theme}
              apiKeyPresent={apiKeyPresent}
              showLTFFibonacci={showLTFFibonacci}
              onShowLTFFibonacciChange={setShowLTFFibonacci}
            />
          </div>
        </div>

        <div className="w-full flex-1 flex flex-col gap-2 sm:gap-4 overflow-hidden order-2 md:order-2">
          <div className={`flex-grow min-h-[400px] md:min-h-0 shadow-lg rounded-lg overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
            <RealTimeTradingChart
              dataSource={dataSource} symbol={actualSymbol} timeframe={timeframe}
              analysisResult={analysisResult} onLatestChartInfoUpdate={handleLatestChartInfoUpdate}
              onChartLoadingStateChange={handleChartLoadingStateChange} movingAverages={movingAverages}
              theme={theme} chartPaneBackgroundColor={chartPaneBackgroundColor}
              showAiAnalysisDrawings={showAiAnalysisDrawings}
              showLTFFibonacci={showLTFFibonacci}
              onHistoricalDataUpdate={handleHistoricalDataUpdate}
              showWSignals={showWSignals}
              wSignalColor={wSignalColor}
              wSignalOpacity={wSignalOpacity}
              signalsOpacity={signalsOpacity}
            />
          </div>
        </div>
      </main>

      {displaySettingsDialogOpen && (
        <DisplaySettingsDialog
          isOpen={displaySettingsDialogOpen}
          onClose={() => setDisplaySettingsDialogOpen(false)}
          theme={theme}
          movingAverages={movingAverages}
          setMovingAverages={setMovingAverages}
          onToggleAllMAs={toggleAllMAsVisibility}
          chartPaneBackgroundColor={chartPaneBackgroundColor}
          setChartPaneBackgroundColor={setChartPaneBackgroundColor}
          volumePaneHeight={volumePaneHeight}
          setVolumePaneHeight={setVolumePaneHeight}
          wSignalColor={wSignalColor}
          setWSignalColor={setWSignalColor}
          wSignalOpacity={wSignalOpacity}
          setWSignalOpacity={setWSignalOpacity}
          showWSignals={showWSignals}
          setShowWSignals={setShowWSignals}
          signalsOpacity={signalsOpacity}
          setSignalsOpacity={setSignalsOpacity}
        />
      )}

      <TemplateManager
        templates={templateManager.templates}
        activeTemplateId={templateManager.activeTemplateId}
        onSaveTemplate={handleSaveTemplate}
        onLoadTemplate={handleLoadTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onSetAsDefault={handleSetAsDefault}
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        theme={theme}
        currentConfig={getCurrentConfiguration()}
      />
    </div>
  );
};

export default App;