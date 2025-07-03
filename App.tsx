
import React, { useState, useEffect, useCallback, useRef } from 'react';
import RealTimeTradingChart from './components/RealTimeTradingChart';
import AnalysisPanel from './components/AnalysisPanel';
import ApiKeyMessage from './components/ApiKeyMessage';
import DisplaySettingsDialog from './components/DisplaySettingsDialog';
import { GeminiAnalysisResult, DataSource, MovingAverageConfig } from './types';
import { analyzeChartWithGemini, ExtendedGeminiRequestPayload } from './services/geminiService';
import { DEFAULT_SYMBOL, DEFAULT_TIMEFRAME, DEFAULT_DATA_SOURCE, CHAT_SYSTEM_PROMPT_TEMPLATE, GEMINI_MODEL_NAME, AVAILABLE_DATA_SOURCES, AVAILABLE_SYMBOLS_BINANCE, AVAILABLE_SYMBOLS_BINGX, QUICK_SELECT_TIMEFRAMES } from './constants';
import { GoogleGenAI, Chat } from "@google/genai";

// Helper for debouncing
function debounce<T extends (...args: any[]) => void>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatSessionRef = useRef<Chat | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('traderoad_dataSource', JSON.stringify(dataSource));
      localStorage.setItem('traderoad_actualSymbol', JSON.stringify(actualSymbol));
      localStorage.setItem('traderoad_timeframe', JSON.stringify(timeframe));
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
    dataSource, actualSymbol, timeframe, theme, movingAverages,
    chartPaneBackgroundColor, volumePaneHeight, showAiAnalysisDrawings,
    wSignalColor, wSignalOpacity, showWSignals
  ]);

  useEffect(() => {
    let keyFromEnv: string | undefined = undefined;
    if (typeof window !== 'undefined' && window.process && window.process.env && typeof window.process.env.API_KEY === 'string') {
      keyFromEnv = window.process.env.API_KEY;
    }
    if (keyFromEnv && keyFromEnv !== "TU_CLAVE_API_DE_GEMINI_AQUI") {
      setApiKey(keyFromEnv);
      setApiKeyPresent(true);
    } else {
      setApiKey(null);
      setApiKeyPresent(false);
      console.warn("Gemini API Key (API_KEY) is not set or is the placeholder value. AI analysis will be disabled.");
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

  const handleRequestAnalysis = useCallback(async () => {
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

    // If switching TO analysis mode AND a result exists for the current context, just show it.
    if (analysisPanelMode !== 'analysis' && analysisResult) {
      setAnalysisPanelMode('analysis');
      setAnalysisLoading(false); // Ensure loading is off if we're just switching views
      setAnalysisError(null);
      return;
    }

    // Otherwise (already in analysis mode OR no result exists), fetch new analysis.
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysisResult(null); // Clear previous result before fetching new one
    setAnalysisPanelMode('analysis'); // Ensure mode is set

    try {
      const displaySymbolForAI = actualSymbol.includes('-') ? actualSymbol.replace('-', '/') : (actualSymbol.endsWith('USDT') ? actualSymbol.replace(/USDT$/, '/USDT') : actualSymbol);
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
  }, [apiKey, actualSymbol, timeframe, latestChartInfo, isChartLoading, analysisResult, analysisPanelMode]);
  
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

    // Inject context if a relevant analysis result is available
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
--- FIN DEL CONTEXTO DEL GRÁFICO ---
`;

    if (analysisResult && 
        analysisResult.analisis_general?.simbolo === displaySymbolForAI &&
        analysisResult.analisis_general?.temporalidad_principal_analisis === timeframe.toUpperCase()
    ) {
        const analysisContext = `--- INICIO DEL CONTEXTO DE ANÁLISIS ---
${chartContext}

ANÁLISIS TÉCNICO PREVIO DISPONIBLE:
${JSON.stringify(analysisResult, null, 2)}
--- FIN DEL CONTEXTO DE ANÁLISIS ---

Pregunta del usuario: ${messageText.trim()}`;
        userTextForAI = analysisContext;
    } else {
        // If no analysis available, still provide chart context
        userTextForAI = `${chartContext}

Pregunta del usuario: ${messageText.trim()}`;
    }


    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: messageText.trim(),
      timestamp: Date.now(),
    };
    setChatMessages((prevMessages) => [...prevMessages, userMessage]);
    setChatLoading(true);
    setChatError(null);

    try {
      const stream = await chatSessionRef.current.sendMessageStream({ message: userTextForAI });
      let currentAiMessageId = crypto.randomUUID();
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
        { id: crypto.randomUUID(), sender: 'ai', text: `Error: ${e.message}`, timestamp: Date.now() },
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

            {/* Timeframes */}
            <div className="flex items-center gap-1">
              {QUICK_SELECT_TIMEFRAMES.slice(0, 4).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`text-xs px-1.5 py-1 rounded transition-colors ${
                    timeframe === tf
                      ? 'bg-sky-500 text-white'
                      : theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {tf}
                </button>
              ))}
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className={`text-xs px-1 py-1 rounded border-0 focus:ring-1 focus:ring-sky-500 ${theme === 'dark' ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'}`}
              >
                {QUICK_SELECT_TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* 1. Análisis IA */}
          <button
            onClick={handleRequestAnalysis}
            disabled={analysisLoading || isChartLoading || !apiKeyPresent}
            title="Análisis IA"
            className={`text-xs px-2 py-1 rounded transition-colors ${
              apiKeyPresent && !analysisLoading && !isChartLoading
                ? 'bg-sky-600 hover:bg-sky-700 text-white'
                : 'bg-slate-600 text-slate-400 cursor-not-allowed'
            }`}
          >
            {analysisLoading ? 'Analizando...' : 'Análisis IA'}
          </button>
          
          {/* 2. Asistente IA */}
          <button
            onClick={handleShowChat}
            disabled={chatLoading || !apiKeyPresent}
            title="Asistente IA"
            className={`text-xs px-2 py-1 rounded transition-colors ${
              apiKeyPresent && !chatLoading
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-slate-600 text-slate-400 cursor-not-allowed'
            }`}
          >
            Asistente IA
          </button>

          {/* 3. Ocultar Dibujos */}
          <button
            onClick={() => setShowAiAnalysisDrawings(!showAiAnalysisDrawings)}
            title={showAiAnalysisDrawings ? 'Ocultar Dibujos' : 'Mostrar Dibujos'}
            className={`text-xs px-2 py-1 rounded transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
          >
            {showAiAnalysisDrawings ? 'Ocultar Dibujos' : 'Mostrar Dibujos'}
          </button>

          {/* 4. Ocultar Panel */}
          <button
            onClick={() => setAnalysisPanelMode(analysisPanelMode === 'initial' ? 'analysis' : 'initial')}
            title={analysisPanelMode === 'initial' ? 'Mostrar Panel' : 'Ocultar Panel'}
            className={`text-xs px-2 py-1 rounded transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
          >
            {analysisPanelMode === 'initial' ? 'Mostrar' : 'Ocultar'}
          </button>
          
          {/* 5. Símbolo de Indicadores (solo símbolo) */}
          <button
            onClick={() => setDisplaySettingsDialogOpen(true)}
            title="Indicadores"
            className={`p-1.5 sm:p-2 rounded transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
          >
            {/* Indicators icon */}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18"/>
              <path d="M7 12l3-3 4 4 5-5"/>
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
            />
          </div>
        </div>
        <div
          id="controls-analysis-panel"
          className={`w-full md:w-80 lg:w-[360px] xl:w-[400px] flex-none flex flex-col gap-2 sm:gap-4 overflow-y-auto order-2 md:order-1 ${
            analysisPanelMode === 'initial' ? 'hidden' : ''
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
    </div>
  );
};

export default App;
