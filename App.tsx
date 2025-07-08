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

// Helper for debouncing
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

const getLocalStorageItem = <T,>(key: string, defaultValue: T): T => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      try {
        return JSON.parse(storedValue) as T;
      } catch (e) {
        console.error(`Error parsing localStorage item ${key}:`, e);
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
  const [favoriteTimeframes, setFavoriteTimeframes] = useState<string[]>(() => getLocalStorageItem('traderoad_favoriteTimeframes', DEFAULT_FAVORITE_TIMEFRAMES));
  const [theme, setTheme] = useState<Theme>(() => getLocalStorageItem('traderoad_theme', 'dark'));
  const [movingAverages, setMovingAverages] = useState<MovingAverageConfig[]>(() => getLocalStorageItem('traderoad_movingAverages', initialMAs));

  const initialBgColorBasedOnTheme = theme === 'dark' ? INITIAL_DARK_CHART_PANE_BACKGROUND_COLOR : INITIAL_LIGHT_CHART_PANE_BACKGROUND_COLOR;
  const [chartPaneBackgroundColor, setChartPaneBackgroundColor] = useState<string>(() =>
    getLocalStorageItem('traderoad_chartPaneBackgroundColor', initialBgColorBasedOnTheme)
  );

  const [volumePaneHeight, setVolumePaneHeight] = useState<number>(() => getLocalStorageItem('traderoad_volumePaneHeight', INITIAL_VOLUME_PANE_HEIGHT));
  const [showAiAnalysisDrawings, setShowAiAnalysisDrawings] = useState<boolean>(() => getLocalStorageItem('traderoad_showAiAnalysisDrawings', true));
  const [wSignalColor, setWSignalColor] = useState<string>(() => getLocalStorageItem('traderoad_wSignalColor', INITIAL_W_SIGNAL_COLOR));
  const [wSignalOpacity, setWSignalOpacity] = useState<number>(() => getLocalStorageItem('traderoad_wSignalOpacity', INITIAL_W_SIGNAL_OPACITY));
  const [showWSignals, setShowWSignals] = useState<boolean>(() => getLocalStorageItem('traderoad_showWSignals', INITIAL_SHOW_W_SIGNALS));

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyPresent, setApiKeyPresent] = useState<boolean>(false);
  const [displaySettingsDialogOpen, setDisplaySettingsDialogOpen] = useState<boolean>(false);

  const [analysisResult, setAnalysisResult] = useState<GeminiAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [latestChartInfo, setLatestChartInfo] = useState<LatestChartInfo>({ price: null, volume: null });
  const [isChartLoading, setIsChartLoading] = useState<boolean>(true);

  const [analysisPanelMode, setAnalysisPanelMode] = useState<AnalysisPanelMode>('initial');

  // 🆕 Sistema de Gestión de Plantillas
  const templateManager = useTemplateManager();
  const [showTemplateManager, setShowTemplateManager] = useState<boolean>(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatSessionRef = useRef<Chat | null>(null);

  // 📝 Paso 1: Estado para los datos históricos del gráfico
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
    }
  }, [
    dataSource, actualSymbol, timeframe, favoriteTimeframes, theme, movingAverages,
    chartPaneBackgroundColor, volumePaneHeight, showAiAnalysisDrawings,
    wSignalColor, wSignalOpacity, showWSignals
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
    if (apiKey && !chatLoading) { // Prevent re-initialization if already loading/processing
      try {
        const ai = new GoogleGenAI({ apiKey });
        chatSessionRef.current = ai.chats.create({
          model: GEMINI_MODEL_NAME,
          config: { systemInstruction: getChatSystemPrompt() },
        });
        setChatError(null); // Clear previous errors on successful init
      } catch (e: any) {
        console.error("Failed to initialize chat session:", e);
        setChatError(`Falló la inicialización del chat IA: ${e.message}.`);
        chatSessionRef.current = null; // Ensure it's null on failure
      }
    }
  }, [apiKey, getChatSystemPrompt, chatLoading]);


  useEffect(() => {
    if (apiKeyPresent) { // Only attempt to initialize if API key is marked as present
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
    // Only clear analysis when symbol or data source changes, not on timeframe changes
    setAnalysisResult(null);
    setAnalysisError(null);
    setAnalysisPanelMode('initial'); // Reset to initial to avoid showing stale analysis for new symbol
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

  const handleLatestChartInfoUpdate = useCallback((info: LatestChartInfo) => setLatestChartInfo(info), []);
  const handleChartLoadingStateChange = useCallback((chartLoading: boolean) => setIsChartLoading(chartLoading), []);

  // 📝 Paso 2: Función receptora para los datos históricos del gráfico
  const handleHistoricalDataUpdate = useCallback((data: MarketDataPoint[]) => {
    setHistoricalData(data.slice(-200)); // Usamos slice para quedarnos con las últimas 200 velas
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

    // 🔥 MEJORA: Verificar si ya existe un análisis válido para evitar regeneración innecesaria
    if (!forceRegenerate && analysisResult &&
      analysisResult.analisis_general?.simbolo === displaySymbolForAI &&
      analysisResult.analisis_general?.temporalidad_principal_analisis === timeframe.toUpperCase()) {
      // Ya tenemos un análisis válido para este símbolo y temporalidad, solo mostrar el panel
      setAnalysisPanelMode('analysis');
      return;
    }

    // Solo regenerar análisis cuando es necesario o explícitamente solicitado
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysisResult(null); // Clear previous result before fetching new one
    setAnalysisPanelMode('analysis'); // Ensure mode is set

    try {
      const payload: ExtendedGeminiRequestPayload = {
        symbol: displaySymbolForAI, timeframe: timeframe.toUpperCase(), currentPrice: latestChartInfo.price,
        marketContextPrompt: "Context will be generated by getFullAnalysisPrompt",
        latestVolume: latestChartInfo.volume, apiKey: apiKey
      };
      const result = await analyzeChartWithGemini(payload);
      setAnalysisResult(result);
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
      initializeChatSession(); // Attempt to initialize if not already done
    }
  };

  const handleSendMessageToChat = async (messageText: string) => {
    if (!messageText.trim() || chatLoading) return;

    if (!chatSessionRef.current) {
      setChatError("La sesión de chat no está inicializada. Intenta de nuevo.");
      initializeChatSession(); // Attempt to re-initialize
      return;
    }

    let userTextForAI = messageText.trim();
    const displaySymbolForAI = actualSymbol.includes('-') ? actualSymbol.replace('-', '/') : (actualSymbol.endsWith('USDT') ? actualSymbol.replace(/USDT$/, '/USDT') : actualSymbol);

    // 📝 Paso 4: Alimentar a la IA con los datos históricos del gráfico
    const chartContext = `--- CONTEXTO DEL GRÁFICO ACTUAL ---
Símbolo: ${displaySymbolForAI}
Temporalidad: ${timeframe.toUpperCase()}
Precio Actual: ${latestChartInfo.price ? `$${latestChartInfo.price.toFixed(Math.abs(latestChartInfo.price) < 1 ? 4 : 2)}` : 'N/A'}
Volumen Última Vela: ${latestChartInfo.volume ? latestChartInfo.volume.toLocaleString() : 'N/A'}
Exchange: ${dataSource.toUpperCase()}

El usuario está viendo un gráfico de trading en tiempo real con las siguientes configuraciones:
- Medias móviles activas: ${movingAverages.filter(ma => ma.visible).map(ma => `${ma.type}${ma.period}`).join(', ')}
- Tema: ${theme}
- Dibujos de análisis IA: ${showAiAnalysisDrawings ? 'Visibles' : 'Ocultos'}

DATOS HISTÓRICOS DEL GRÁFICO (últimas ${historicalData.length} velas):
${historicalData.length > 0 ? JSON.stringify(historicalData.slice(-50), null, 2) : 'No hay datos históricos disponibles aún'}
--- FIN DEL CONTEXTO DEL GRÁFICO ---
`;

    // 🔥 MEJORA: Siempre incluir análisis previo disponible, incluso si es de otra temporalidad
    if (analysisResult && analysisResult.analisis_general?.simbolo === displaySymbolForAI) {
      const isMatchingTimeframe = analysisResult.analisis_general?.temporalidad_principal_analisis === timeframe.toUpperCase();

      let timeframeNote = "";
      if (!isMatchingTimeframe) {
        timeframeNote = `

⚠️ NOTA IMPORTANTE PARA LA IA: El análisis técnico disponible fue generado para la temporalidad ${analysisResult.analisis_general?.temporalidad_principal_analisis || 'N/A'}, pero el usuario está viendo actualmente el gráfico en ${timeframe.toUpperCase()}. Considera esta diferencia en tu respuesta. El análisis sigue siendo válido como contexto, pero puedes mencionar que algunas observaciones podrían ser más relevantes en la temporalidad original del análisis.`;
      }

      const analysisContext = `--- INICIO DEL CONTEXTO DE ANÁLISIS ---
${chartContext}

ANÁLISIS TÉCNICO PREVIO DISPONIBLE:
${JSON.stringify(analysisResult, null, 2)}${timeframeNote}
--- FIN DEL CONTEXTO DE ANÁLISIS ---

Pregunta del usuario: ${messageText.trim()}`;
      userTextForAI = analysisContext;
    } else {
      // If no analysis available for this symbol, still provide chart context
      userTextForAI = `${chartContext}

Pregunta del usuario: ${messageText.trim()}`;
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
    // Re-initialize chat session to clear AI's context as well
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
      if (prev.includes(timeframe)) {
        // Remove from favorites
        return prev.filter(tf => tf !== timeframe);
      } else {
        // Add to favorites (limit to 8 for UI space)
        if (prev.length >= 8) {
          // Replace the last one
          return [...prev.slice(0, 7), timeframe];
        }
        return [...prev, timeframe];
      }
    });
  };

  const resetToDefaultFavorites = () => {
    setFavoriteTimeframes([...DEFAULT_FAVORITE_TIMEFRAMES]);
  };

  // 🆕 Funciones para el Sistema de Plantillas
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
    const templateId = templateManager.saveTemplate(template);
    console.log('Template saved with ID:', templateId);
  }, [templateManager]);

  const handleLoadTemplate = useCallback((templateId: string) => {
    const config = templateManager.loadTemplate(templateId);
    if (config) {
      // Aplicar toda la configuración cargada
      setMovingAverages(config.movingAverages);
      setTheme(config.theme);
      setChartPaneBackgroundColor(config.chartPaneBackgroundColor);
      setVolumePaneHeight(config.volumePaneHeight);
      setWSignalColor(config.wSignalColor);
      setWSignalOpacity(config.wSignalOpacity);
      setShowWSignals(config.showWSignals);
      setShowAiAnalysisDrawings(config.showAiAnalysisDrawings);
      setFavoriteTimeframes(config.favoriteTimeframes);

      // Configuración opcional por defecto
      if (config.defaultDataSource) {
        setDataSource(config.defaultDataSource);
      }
      if (config.defaultSymbol) {
        const consistentSymbol = getConsistentSymbolForDataSource(config.defaultSymbol, config.defaultDataSource || dataSource);
        setActualSymbol(consistentSymbol);
        setSymbolInput(consistentSymbol);
      }
      if (config.defaultTimeframe) {
        setTimeframe(config.defaultTimeframe);
      }

      console.log('Template loaded and applied');
    }
  }, [templateManager, dataSource]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    templateManager.deleteTemplate(templateId);
    console.log('Template deleted:', templateId);
  }, [templateManager]);

  const handleSetAsDefault = useCallback((templateId: string) => {
    templateManager.setAsDefault(templateId);
    console.log('Template set as default:', templateId);
  }, [templateManager]);

  // Crear plantilla por defecto si es necesario
  useEffect(() => {
    templateManager.createDefaultTemplateIfNeeded(getCurrentConfiguration());
  }, [templateManager, getCurrentConfiguration]);

  // Actualizar plantilla activa cuando cambie la configuración
  useEffect(() => {
    if (templateManager.activeTemplateId) {
      templateManager.updateActiveTemplate(getCurrentConfiguration());
    }
  }, [templateManager, getCurrentConfiguration]);

  return (
    <div className={`flex flex-col h-screen antialiased ${theme === 'dark' ? 'bg-slate-900 text-slate-100' : 'bg-gray-100 text-gray-900'}`}>
      <header className={`p-2 sm:p-3 shadow-md flex justify-between items-center ${theme === 'dark' ? 'bg-slate-800' : 'bg-white border-b border-gray-200'}`}>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            {/* Logo */}
            <img src="/logo.png" alt="TradingRoad Logo" className="w-6 h-6" />
            <h1 className={`text-lg sm:text-xl font-bold ${theme === 'dark' ? 'text-sky-400' : 'text-sky-600'}`}>TradingRoad</h1>
          </div>

          {/* Controles discretos del mercado */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Exchange selector */}
            <select
              value={dataSource}
              onChange={(e) => handleDataSourceChange(e.target.value as DataSource)}
              className={`text-xs px-2 py-1 rounded border-0 focus:ring-1 focus:ring-sky-500 ${theme === 'dark' ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'}`}
            >
              {AVAILABLE_DATA_SOURCES.map(ds => <option key={ds.value} value={ds.value}>{ds.label}</option>)}
            </select>

            {/* Symbol selector with dropdown and manual input */}
            <div className="flex items-center gap-1">
              <select
                value={symbolInput}
                onChange={(e) => handleSymbolInputChange(e.target.value)}
                className={`text-xs px-2 py-1 w-20 sm:w-24 rounded border-0 focus:ring-1 focus:ring-sky-500 ${theme === 'dark' ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'}`}
              >
                {(dataSource === 'bingx' ? AVAILABLE_SYMBOLS_BINGX : AVAILABLE_SYMBOLS_BINANCE).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Manual input for custom symbols */}
              <input
                type="text"
                value={symbolInput}
                onChange={(e) => handleSymbolInputChange(e.target.value)}
                placeholder="Escribir..."
                className={`text-xs px-2 py-1 w-16 sm:w-20 rounded border-0 focus:ring-1 focus:ring-sky-500 ${theme === 'dark' ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'}`}
              />
            </div>

            {/* Timeframes with Smart Favorites System */}
            <div className="flex items-center gap-1">
              {/* Favorite timeframes - showing all favorites ordered */}
              {favoriteTimeframes
                .sort((a, b) => {
                  // Order by typical trading hierarchy: m -> h -> d -> w
                  const order = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
                  return order.indexOf(a) - order.indexOf(b);
                })
                .map(tf => (
                  <div key={tf} className="relative group">
                    <button
                      onClick={() => setTimeframe(tf)}
                      onDoubleClick={() => toggleTimeframeFavorite(tf)}
                      title={`${tf.toUpperCase()} - Doble click para quitar de favoritos`}
                      className={`relative text-xs px-2.5 py-1.5 rounded-lg transition-all duration-200 border ${timeframe === tf
                        ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-500/30 scale-105 border-sky-400'
                        : theme === 'dark'
                          ? 'bg-slate-700 hover:bg-slate-600 text-slate-200 hover:scale-105 border-slate-600 hover:border-slate-500'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:scale-105 border-gray-200 hover:border-gray-300'
                        } ${favoriteTimeframes.length > 6 ? 'px-1.5 py-1' : 'px-2.5 py-1.5'}`}
                    >
                      <span className="font-medium">{tf.toUpperCase()}</span>
                    </button>
                  </div>
                ))}

              {/* Dropdown for managing timeframes */}
              <div className="relative group">
                <select
                  value={timeframe}
                  onChange={(e) => {
                    if (e.target.value === 'RESET_FAVORITES') {
                      resetToDefaultFavorites();
                      return;
                    }
                    setTimeframe(e.target.value);
                  }}
                  title="Gestionar temporalidades"
                  className={`text-xs px-2 py-1.5 rounded-lg border-0 focus:ring-2 focus:ring-sky-500 transition-all ${theme === 'dark'
                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <optgroup label="📌 Favoritos">
                    {favoriteTimeframes
                      .sort((a, b) => {
                        const order = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
                        return order.indexOf(a) - order.indexOf(b);
                      })
                      .map(tf => (
                        <option key={`fav-${tf}`} value={tf}>{tf.toUpperCase()}</option>
                      ))}
                  </optgroup>
                  <optgroup label="➕ Añadir más">
                    {QUICK_SELECT_TIMEFRAMES
                      .filter(tf => !favoriteTimeframes.includes(tf))
                      .map(tf => (
                        <option key={tf} value={tf}>{tf.toUpperCase()}</option>
                      ))}
                  </optgroup>
                  <optgroup label="⚙️ Gestión">
                    <option value="RESET_FAVORITES">🔄 Restaurar por defecto</option>
                  </optgroup>
                </select>

                {/* Enhanced Add/Remove favorite button with counter */}
                <button
                  onClick={() => toggleTimeframeFavorite(timeframe)}
                  title={`${favoriteTimeframes.includes(timeframe) ? 'Quitar de favoritos' : 'Añadir a favoritos'} (${favoriteTimeframes.length}/8 favoritos)`}
                  className={`ml-1 text-xs px-2 py-1.5 rounded-lg transition-all duration-200 relative ${favoriteTimeframes.includes(timeframe)
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white hover:from-yellow-600 hover:to-amber-600 shadow-md'
                    : theme === 'dark'
                      ? 'bg-slate-600 text-slate-300 hover:bg-yellow-500 hover:text-white border border-slate-500 hover:border-yellow-500'
                      : 'bg-gray-200 text-gray-600 hover:bg-yellow-500 hover:text-white border border-gray-300 hover:border-yellow-500'
                    }`}
                >
                  {favoriteTimeframes.includes(timeframe) ? '✓' : '+'}
                  {/* Counter badge */}
                  <span className={`absolute -top-1 -right-1 w-4 h-4 text-xs rounded-full flex items-center justify-center font-bold ${favoriteTimeframes.length >= 8
                    ? 'bg-red-500 text-white'
                    : 'bg-blue-500 text-white'
                    }`}>
                    {favoriteTimeframes.length}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 1. Análisis IA - Nuevo diseño con iconos y estado */}
          <button
            onClick={(e) => handleRequestAnalysis(e.shiftKey)}
            disabled={analysisLoading || isChartLoading || !apiKeyPresent}
            title={`Análisis IA${apiKeyPresent ? ' (Shift+Click para regenerar)' : ''}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all duration-300 shadow-md relative overflow-hidden ${apiKeyPresent && !analysisLoading && !isChartLoading
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-blue-500/25'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed shadow-none'
              }`}
          >
            <div className="w-4 h-4 flex items-center justify-center relative">
              {analysisLoading ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 3v18h18M7 12l3-3 4 4 5-5" />
                  <path d="M21 7v4h-4" />
                </svg>
              )}
            </div>
            <span className="text-xs font-medium">
              {analysisLoading ? 'Analizando...' : 'Análisis IA'}
            </span>
            <div className={`w-1.5 h-1.5 rounded-full absolute top-0.5 right-0.5 ${apiKeyPresent ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-red-400'}`}></div>
          </button>

          {/* 2. TradeGuru IA - Nuevo diseño */}
          <button
            onClick={handleShowChat}
            disabled={chatLoading || !apiKeyPresent}
            title="TradeGuru IA"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all duration-300 shadow-md relative overflow-hidden ${apiKeyPresent && !chatLoading
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/25'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed shadow-none'
              }`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 4c3.31 0 6 2.69 6 6v8h-2v-2H8v2H6v-8c0-3.31 2.69-6 6-6zm-3 8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
              </svg>
            </div>
            <span className="text-xs font-medium">Chat IA</span>
            <div className={`w-1.5 h-1.5 rounded-full absolute top-0.5 right-0.5 ${apiKeyPresent ? 'bg-green-400 shadow-lg shadow-green-400/50 animate-pulse' : 'bg-red-400'}`}></div>
          </button>

          {/* 3. Señales - Nuevo diseño */}
          <button
            onClick={() => setShowAiAnalysisDrawings(!showAiAnalysisDrawings)}
            title={showAiAnalysisDrawings ? 'Ocultar Señales' : 'Mostrar Señales'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all duration-300 shadow-md relative overflow-hidden ${showAiAnalysisDrawings
              ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-orange-500/25'
              : 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white shadow-gray-500/25'
              }`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <span className="text-xs font-medium">Señales</span>
            <div className={`w-1.5 h-1.5 rounded-full absolute top-0.5 right-0.5 ${showAiAnalysisDrawings ? 'bg-white shadow-lg shadow-white/50' : 'bg-gray-400'}`}></div>
          </button>

          {/* 4. Indicadores - Solo símbolo */}
          <button
            onClick={() => setDisplaySettingsDialogOpen(true)}
            title="Configuración e Indicadores"
            className={`flex items-center justify-center p-1.5 sm:p-2 rounded-lg transition-all duration-300 shadow-md ${theme === 'dark'
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-indigo-500/25'
              : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white shadow-indigo-500/25'
              }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M7 12l3-3 4 4 5-5" />
            </svg>
          </button>

          {/* 4.5. Plantillas - Gestión de Configuraciones */}
          <button
            onClick={() => setShowTemplateManager(true)}
            title={`Gestión de Plantillas${templateManager.activeTemplateId ? ` (Activa: ${templateManager.getActiveTemplate()?.name})` : ''}`}
            className={`flex items-center justify-center p-1.5 sm:p-2 rounded-lg transition-all duration-300 shadow-md ${theme === 'dark'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/25'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-emerald-500/25'
              }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
              <path d="M8 21v-4a2 2 0 012-2h4a2 2 0 012 2v4" />
              <path d="M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
            </svg>
          </button>

          {/* 5. Panel Toggle - Mostrar/Ocultar Panel */}
          <button
            onClick={() => setAnalysisPanelMode(analysisPanelMode === 'initial' ? (analysisResult ? 'analysis' : 'initial') : 'initial')}
            title={analysisPanelMode === 'initial' ? 'Mostrar Panel IA' : 'Ocultar Panel IA'}
            className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d={analysisPanelMode === 'initial' ? "M9 5v14l11-7z" : "M15 19l-7-7 7-7v14z"} />
            </svg>
          </button>

          {/* 6. Día y noche */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`}
            aria-label={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`}
            className={`p-1.5 sm:p-2 rounded text-xs transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <ApiKeyMessage apiKeyPresent={apiKeyPresent} />

      <main className="flex-grow flex flex-col md:flex-row p-2 sm:p-4 gap-2 sm:gap-4 overflow-y-auto">
        <div className={`w-full flex-1 flex flex-col gap-2 sm:gap-4 overflow-hidden order-1 ${analysisPanelMode !== 'initial' ? 'md:order-2' : 'md:order-1'}`}>
          <div className={`flex-grow min-h-[300px] sm:min-h-[400px] md:min-h-0 shadow-lg rounded-lg overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
            <RealTimeTradingChart
              dataSource={dataSource} symbol={actualSymbol} timeframe={timeframe}
              analysisResult={analysisResult} onLatestChartInfoUpdate={handleLatestChartInfoUpdate}
              onChartLoadingStateChange={handleChartLoadingStateChange} movingAverages={movingAverages}
              theme={theme} chartPaneBackgroundColor={chartPaneBackgroundColor}
              volumePaneHeight={volumePaneHeight} showAiAnalysisDrawings={showAiAnalysisDrawings}
              wSignalColor={wSignalColor} wSignalOpacity={wSignalOpacity / 100}
              showWSignals={showWSignals}
              onHistoricalDataUpdate={handleHistoricalDataUpdate}
            />
          </div>
        </div>
        <div
          id="controls-analysis-panel"
          className={`w-full md:w-80 lg:w-[360px] xl:w-[400px] flex-none flex flex-col gap-2 sm:gap-4 overflow-y-auto order-2 md:order-1 ${analysisPanelMode === 'initial' ? 'hidden' : ''
            }`}
        >
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
        />
      )}

      {/* 🆕 Gestor de Plantillas */}
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
