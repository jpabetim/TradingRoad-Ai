import React, { useRef, useEffect, useState } from 'react';
import { GeminiAnalysisResult, TradeSetup, AnalysisPointType, FibonacciAnalysis, FibonacciLevel, FibonacciImpulseAnalysis } from '../types';
import { AnalysisPanelMode, ChatMessage } from '../App';
import { calculateFibonacciRetracements, calculateFibonacciExtensions } from '../utils/fibonacci';

interface AnalysisPanelProps {
  panelMode: AnalysisPanelMode;
  analysisResult: GeminiAnalysisResult | null;
  analysisLoading: boolean;
  analysisError: string | null;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  chatError: string | null;
  onSendMessage: (message: string) => void;
  onClearChatHistory: () => void;
  theme: 'dark' | 'light';
  apiKeyPresent: boolean;
  showLTFFibonacci: boolean;
  onShowLTFFibonacciChange: (show: boolean) => void;
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-sm sm:text-base md:text-lg font-semibold mt-2 sm:mt-3 md:mt-4 mb-1 sm:mb-1.5 md:mb-2 text-sky-400 border-b border-slate-700 pb-1">{children}</h3>
);

const DetailItem: React.FC<{ label: string; value?: string | number | null; isCode?: boolean; valueClassName?: string }> = ({
  label,
  value,
  isCode = false,
  valueClassName = ""
}: {
  label: string;
  value?: string | number | null;
  isCode?: boolean;
  valueClassName?: string
}) => (
  value || value === 0 ? (
    <p className="text-xs sm:text-sm text-slate-300">
      <span className="font-medium text-slate-100">{label}:</span>{' '}
      {isCode ? <code className="text-xs bg-slate-600 p-0.5 sm:p-1 rounded">{value}</code> : <span className={valueClassName}>{value}</span>}
    </p>
  ) : null
);


const TradeSetupDisplay: React.FC<{ setup: TradeSetup | undefined; }> = ({
  setup
}: {
  setup: TradeSetup | undefined;
}) => {
  if (!setup || setup.tipo === "ninguno") {
    return <p className="text-xs sm:text-sm text-slate-400 italic">No se identificó una configuración de trade específica.</p>;
  }

  // Mapeo de colores y estilos para cada tipo de trading
  const estiloConfig: Record<string, { color: string; icon: string; description: string }> = {
    scalping: {
      color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
      icon: "⚡",
      description: "Operación rápida (minutos)"
    },
    intradia: {
      color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
      icon: "🕐",
      description: "Operación intradía (horas)"
    },
    swing: {
      color: "text-purple-400 bg-purple-400/10 border-purple-400/30",
      icon: "📈",
      description: "Operación swing (días/semanas)"
    },
    largo_plazo: {
      color: "text-orange-400 bg-orange-400/10 border-orange-400/30",
      icon: "🎯",
      description: "Operación a largo plazo (semanas/meses)"
    }
  };

  const estiloInfo = estiloConfig[setup.estilo_trade || ''] || {
    color: "text-slate-300 bg-slate-600/10 border-slate-400/30",
    icon: "📊",
    description: "Estilo no especificado"
  };

  return (
    <div className="space-y-2 mt-1 p-3 bg-slate-700/50 rounded-md border border-slate-600/30">
      {/* Header con información principal del trade */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 pb-2 border-b border-slate-600/40">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-100">Tipo:</span>
          <span className={`font-bold text-sm ${setup.tipo === 'largo' ? 'text-green-400' : 'text-red-400'}`}>
            {setup.tipo?.toUpperCase()}
          </span>
        </div>

        {/* NUEVO: Badge de estilo de trading */}
        {setup.estilo_trade && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${estiloInfo.color}`}>
            <span className="text-sm">{estiloInfo.icon}</span>
            <div className="flex flex-col">
              <span className="font-bold">{setup.estilo_trade.toUpperCase()}</span>
              <span className="text-xs opacity-80">{estiloInfo.description}</span>
            </div>
          </div>
        )}
      </div>

      {/* NUEVO: Mostrar Calificación y Confluencias */}
      {setup.calificacion_setup && (
        <div className="p-2.5 bg-slate-800 rounded-lg border border-slate-600/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-sky-300">
              Calificación: {setup.calificacion_setup.calificacion}
            </span>
            <div className={`px-2 py-0.5 rounded text-xs font-bold ${setup.calificacion_setup.calificacion === 'A' ? 'bg-green-500/20 text-green-400' :
              setup.calificacion_setup.calificacion === 'B' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
              {setup.calificacion_setup.calificacion === 'A' ? 'ALTA PROBABILIDAD' :
                setup.calificacion_setup.calificacion === 'B' ? 'PROBABILIDAD MEDIA' :
                  'ESPECULATIVO'}
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-200 mb-1 block">Confluencias:</span>
            <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5 pl-2">
              {setup.calificacion_setup.confluencias.map((con, idx) => (
                <li key={idx} className="leading-relaxed">{con}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Detalles del setup */}
      <div className="space-y-1">
        <DetailItem label="Condición de Entrada" value={setup.descripcion_entrada} />
        <DetailItem label="Precio de Entrada Ideal" value={setup.punto_entrada_ideal ? `$${setup.punto_entrada_ideal.toFixed(Math.abs(setup.punto_entrada_ideal) < 1 ? 4 : 2)}` : undefined} />
        <DetailItem label="Zona de Entrada" value={setup.zona_entrada ? `[$${setup.zona_entrada[0].toFixed(Math.abs(setup.zona_entrada[0]) < 1 ? 4 : 2)} - $${setup.zona_entrada[1].toFixed(Math.abs(setup.zona_entrada[1]) < 1 ? 4 : 2)}]` : undefined} />
        <DetailItem label="Stop Loss" value={setup.stop_loss ? `$${setup.stop_loss.toFixed(Math.abs(setup.stop_loss) < 1 ? 4 : 2)}` : undefined} />
        <DetailItem label="Lógica del Stop Loss" value={setup.gestion_stop_loss} />
        <DetailItem label="Take Profit 1" value={setup.take_profit_1 ? `$${setup.take_profit_1.toFixed(Math.abs(setup.take_profit_1) < 1 ? 4 : 2)}` : undefined} />
        {setup.take_profit_2 && <DetailItem label="Take Profit 2" value={`$${setup.take_profit_2.toFixed(Math.abs(setup.take_profit_2) < 1 ? 4 : 2)}`} />}
        {setup.take_profit_3 && <DetailItem label="Take Profit 3" value={`$${setup.take_profit_3.toFixed(Math.abs(setup.take_profit_3) < 1 ? 4 : 2)}`} />}
        <DetailItem label="Lógica del Take Profit" value={setup.gestion_take_profit} />
        {setup.razon_fundamental && <p className="text-xs sm:text-sm text-slate-300 mt-1"><span className="font-medium text-slate-100">Razón:</span> {setup.razon_fundamental}</p>}
        {setup.confirmaciones_adicionales && setup.confirmaciones_adicionales.length > 0 && (
          <DetailItem label="Confirmaciones" value={setup.confirmaciones_adicionales.join(', ')} />
        )}
        <DetailItem label="Riesgo/Beneficio" value={setup.ratio_riesgo_beneficio} />
        <DetailItem label="Confianza" value={setup.calificacion_confianza} />
      </div>
    </div>
  );
};

const FibonacciLevelDisplay: React.FC<{ level: FibonacciLevel }> = ({ level }: { level: FibonacciLevel }) => (
  <li className="text-xs">
    <span className="font-medium text-slate-200">{level.label}:</span> ${level.price != null ? level.price.toFixed(Math.abs(level.price) < 1 ? 4 : 2) : 'N/A'}
  </li>
);

// NUEVO SUB-COMPONENTE REUTILIZABLE para mostrar un único análisis de impulso
const SingleFibonacciImpulse: React.FC<{
  title: string;
  impulseAnalysis: FibonacciImpulseAnalysis;
}> = ({ title, impulseAnalysis }) => {
  const {
    temporalidad_analizada,
    descripcion_impulso,
    precio_inicio_impulso,
    precio_fin_impulso,
    precio_fin_retroceso,
  } = impulseAnalysis;

  const retracementLevels = calculateFibonacciRetracements(
    precio_inicio_impulso,
    precio_fin_impulso,
    [0.382, 0.5, 0.618, 0.78]
  ).filter(level => level.price != null && !isNaN(level.price));

  const extensionLevels = precio_fin_retroceso != null
    ? calculateFibonacciExtensions(
      precio_inicio_impulso,
      precio_fin_impulso,
      precio_fin_retroceso,
      [1.272, 1.618, 2.618]
    ).filter(level => level.price != null && !isNaN(level.price))
    : [];

  const isUpwardImpulse = precio_fin_impulso > precio_inicio_impulso;

  const sortedRetracementLevels = [...retracementLevels].sort((a, b) =>
    isUpwardImpulse ? b.price - a.price : a.price - b.price
  );

  const sortedExtensionLevels = [...extensionLevels].sort((a, b) => a.level - b.level);

  return (
    <div className="space-y-1.5 mt-1.5 p-2 bg-slate-700/80 rounded-md">
      <h4 className="text-sm font-semibold text-sky-300">{title} ({temporalidad_analizada})</h4>
      <p className="text-xs text-slate-300"><span className="font-medium text-slate-100">Impulso:</span> {descripcion_impulso}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 text-xs">
        <DetailItem label="Inicio (A)" value={precio_inicio_impulso != null ? `$${precio_inicio_impulso.toFixed(Math.abs(precio_inicio_impulso) < 1 ? 4 : 2)}` : 'N/A'} />
        <DetailItem label="Fin (B)" value={precio_fin_impulso != null ? `$${precio_fin_impulso.toFixed(Math.abs(precio_fin_impulso) < 1 ? 4 : 2)}` : 'N/A'} />
        {precio_fin_retroceso != null && (
          <DetailItem label="Retroceso (C)" value={`$${precio_fin_retroceso.toFixed(Math.abs(precio_fin_retroceso) < 1 ? 4 : 2)}`} />
        )}
      </div>

      {sortedRetracementLevels.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-slate-200 mt-1.5 mb-1">Retrocesos:</h5>
          <ul className="list-disc list-inside space-y-0.5 pl-2">
            {sortedRetracementLevels.map((level, index) => <FibonacciLevelDisplay key={`ret-${index}`} level={level} />)}
          </ul>
        </div>
      )}

      {sortedExtensionLevels.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-slate-200 mt-1.5 mb-1">Extensiones:</h5>
          <ul className="list-disc list-inside space-y-0.5 pl-2">
            {sortedExtensionLevels.map((level, index) => <FibonacciLevelDisplay key={`ext-${index}`} level={level} />)}
          </ul>
        </div>
      )}
    </div>
  );
};

// COMPONENTE PRINCIPAL ACTUALIZADO - Fibonacci con toggle para 1H y prevención de duplicados
const FibonacciAnalysisDisplay: React.FC<{
  fiboAnalysis: FibonacciAnalysis | undefined;
  showLTFFibonacci: boolean;
  onShowLTFFibonacciChange: (show: boolean) => void;
}> = ({ fiboAnalysis, showLTFFibonacci, onShowLTFFibonacciChange }) => {

  if (!fiboAnalysis) {
    return <p className="text-xs sm:text-sm text-slate-400 italic">Análisis Fibonacci no disponible.</p>;
  }

  const hasHTF = fiboAnalysis.htf != null;
  const hasLTF = fiboAnalysis.ltf != null;

  if (!hasHTF && !hasLTF) {
    return <p className="text-xs sm:text-sm text-slate-400 italic">Análisis Fibonacci no disponible.</p>;
  }

  // Función para detectar si HTF y LTF son duplicados (mismo timeframe y puntos similares)
  const areAnalysesDuplicated = (htf: FibonacciImpulseAnalysis, ltf: FibonacciImpulseAnalysis): boolean => {
    if (!htf || !ltf) return false;

    // Si ambos tienen la misma temporalidad, son duplicados
    if (htf.temporalidad_analizada === ltf.temporalidad_analizada) return true;

    // Si los puntos de inicio y fin son muy similares (diferencia < 1%), son duplicados
    const startDiff = Math.abs(htf.precio_inicio_impulso - ltf.precio_inicio_impulso);
    const endDiff = Math.abs(htf.precio_fin_impulso - ltf.precio_fin_impulso);
    const avgPrice = (htf.precio_inicio_impulso + htf.precio_fin_impulso) / 2;

    return (startDiff / avgPrice < 0.01) && (endDiff / avgPrice < 0.01);
  };

  // Detectar duplicados
  const isDuplicated = hasHTF && hasLTF && areAnalysesDuplicated(fiboAnalysis.htf!, fiboAnalysis.ltf!);

  // Lógica mejorada para mostrar toggle solo cuando realmente hay HTF (4H) y LTF (1H) diferentes
  const shouldShowToggle = hasHTF && hasLTF && !isDuplicated &&
    fiboAnalysis.htf?.temporalidad_analizada === '4H' &&
    fiboAnalysis.ltf?.temporalidad_analizada === '1H';

  const shouldShowLTF = hasLTF && (!hasHTF || (!isDuplicated && showLTFFibonacci));

  return (
    <div className="space-y-2 mt-1 p-2 bg-slate-700 rounded-md">
      {/* Siempre mostrar HTF si está disponible */}
      {hasHTF && fiboAnalysis.htf && (
        <SingleFibonacciImpulse
          title={`Análisis Macro (${fiboAnalysis.htf.temporalidad_analizada || 'HTF'})`}
          impulseAnalysis={fiboAnalysis.htf}
        />
      )}

      {/* Toggle para LTF solo si tenemos ambos y NO son duplicados */}
      {shouldShowToggle && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-600">
          <span className="text-xs text-slate-300">
            Mostrar Fibonacci 1H
          </span>
          <button
            onClick={() => onShowLTFFibonacciChange(!showLTFFibonacci)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${showLTFFibonacci ? 'bg-sky-600' : 'bg-slate-600'
              }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${showLTFFibonacci ? 'translate-x-5' : 'translate-x-1'
                }`}
            />
          </button>
        </div>
      )}

      {/* Mostrar LTF si debe mostrarse y no es duplicado */}
      {shouldShowLTF && fiboAnalysis.ltf && (
        <SingleFibonacciImpulse
          title={`Análisis de Temporalidad Actual (${fiboAnalysis.ltf.temporalidad_analizada || 'LTF'})`}
          impulseAnalysis={fiboAnalysis.ltf}
        />
      )}

      {/* Mensaje informativo si se detectan duplicados */}
      {isDuplicated && (
        <div className="text-xs text-slate-400 italic mt-2 p-2 bg-slate-800 rounded border border-slate-600">
          ℹ️ Se detectó el mismo análisis en ambas temporalidades. Mostrando solo el análisis macro.
        </div>
      )}
    </div>
  );
};

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  panelMode,
  analysisResult,
  analysisLoading,
  analysisError,
  chatMessages,
  chatLoading,
  chatError,
  onSendMessage,
  onClearChatHistory,
  theme,
  apiKeyPresent,
  showLTFFibonacci,
  onShowLTFFibonacciChange,
}) => {
  const [chatInputValue, setChatInputValue] = useState('');
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (panelMode === 'chat') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, panelMode]);

  useEffect(() => {
    if (panelMode === 'chat' && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [panelMode]);

  const handleChatSend = () => {
    if (chatInputValue.trim()) {
      onSendMessage(chatInputValue.trim());
      setChatInputValue('');
    }
  };

  const StatusDisplayWrapper: React.FC<{ title: string; children: React.ReactNode; titleColor?: string }> = ({ title, children, titleColor = "text-sky-400" }) => (
    <div className="p-3 sm:p-4 bg-slate-800 rounded-lg shadow h-full">
      <h2 className={`text-lg sm:text-xl font-semibold mb-2 ${titleColor}`}>{title}</h2>
      <div className="text-xs sm:text-sm text-slate-300">{children}</div>
    </div>
  );

  // Función para extraer un resumen de oportunidades por estilo
  const getOpportunitiesSummary = (analysisResult: GeminiAnalysisResult) => {
    const opportunities: Array<{ style: string; type: string; scenario: string }> = [];

    // La única fuente de verdad serán los escenarios probables.
    // Esto evita duplicados o setups vacíos.
    analysisResult.escenarios_probables?.forEach(scenario => {
      if (scenario.trade_setup_asociado && scenario.trade_setup_asociado.tipo !== "ninguno") {
        opportunities.push({
          style: scenario.trade_setup_asociado.estilo_trade || "sin_clasificar",
          type: scenario.trade_setup_asociado.tipo,
          scenario: scenario.nombre_escenario
        });
      }
    });

    return opportunities;
  };

  const renderAnalysisContent = () => {
    if (analysisLoading) {
      return <div className="p-3 sm:p-4 text-center">Cargando análisis...</div>;
    }
    if (analysisError) {
      return <div className="p-3 sm:p-4 text-red-400">Error en Análisis: {analysisError}</div>;
    }
    if (!analysisResult) {
      return <div className="p-3 sm:p-4 text-center">Selecciona "Análisis IA" para obtener un análisis técnico.</div>;
    }

    const primaryScenario = analysisResult.escenarios_probables?.find(s => s.probabilidad === 'alta') || analysisResult.escenarios_probables?.[0];
    const alternativeScenarios = analysisResult.escenarios_probables?.filter(s => s !== primaryScenario) || [];
    const activeSignalType = analysisResult.conclusion_recomendacion?.mejor_oportunidad_actual?.tipo;
    const overallBias = analysisResult.analisis_general?.sesgo_direccional_general;
    const biasColorMap: Record<string, string> = { alcista: "text-green-400", bajista: "text-red-400" };
    const biasColorClass = biasColorMap[overallBias?.toLowerCase() || ''] || "text-slate-300";
    const activeSignalColorMap: Record<string, string> = { largo: 'text-green-400', corto: 'text-red-400' };
    const activeSignalColorClass = activeSignalColorMap[activeSignalType?.toLowerCase() || ''] || 'text-slate-300';

    return (
      <div className="p-3 sm:p-4">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-2 sm:mb-3 text-sky-400">Resultados del Análisis IA</h2>

        {/* NUEVO: Resumen de Oportunidades por Estilo */}
        {(() => {
          const opportunities = getOpportunitiesSummary(analysisResult);
          if (opportunities.length > 0) {
            const styleIcons: Record<string, string> = {
              scalping: "⚡",
              intradia: "🕐",
              swing: "📈",
              largo_plazo: "🎯",
              sin_clasificar: "📊"
            };

            return (
              <>
                <SectionTitle>🎯 Oportunidades Detectadas</SectionTitle>
                <div className="grid grid-cols-1 gap-2 mb-3 sm:mb-4">
                  {opportunities.map((opp, idx) => (
                    <div key={idx} className={`p-2 sm:p-3 rounded-lg border text-xs sm:text-sm ${opp.style === 'scalping' ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400' :
                      opp.style === 'intradia' ? 'bg-cyan-400/10 border-cyan-400/30 text-cyan-400' :
                        opp.style === 'swing' ? 'bg-purple-400/10 border-purple-400/30 text-purple-400' :
                          opp.style === 'largo_plazo' ? 'bg-orange-400/10 border-orange-400/30 text-orange-400' :
                            'bg-slate-600/10 border-slate-400/30 text-slate-300'
                      }`}>
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-sm">{styleIcons[opp.style] || styleIcons.sin_clasificar}</span>
                        <span className="font-bold text-xs">{(opp.style || 'sin_clasificar').toUpperCase()}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${opp.type === 'largo' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                          {(opp.type || 'ninguno').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs opacity-80 leading-tight">{opp.scenario}</p>
                    </div>
                  ))}
                </div>
              </>
            );
          }
          return null;
        })()}

        {primaryScenario && (
          <>
            <SectionTitle>Escenario Principal</SectionTitle>
            <div className="p-2 sm:p-3 bg-slate-700 rounded-md">
              <p className="text-xs sm:text-sm font-semibold text-slate-100">{primaryScenario.nombre_escenario}</p>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{primaryScenario.descripcion_detallada}</p>
              {primaryScenario.niveles_clave_de_invalidacion && (
                <p className="text-xs text-slate-400 mt-1">Invalidación: {primaryScenario.niveles_clave_de_invalidacion}</p>
              )}
              {primaryScenario.trade_setup_asociado && primaryScenario.trade_setup_asociado.tipo !== "ninguno" && (
                <>
                  <p className="text-xs font-semibold text-slate-100 mt-1.5 sm:mt-2">
                    Configuración Asociada: <span className={primaryScenario.trade_setup_asociado.tipo === 'largo' ? 'text-green-400' : 'text-red-400'}>{primaryScenario.trade_setup_asociado.tipo.toUpperCase()}</span>
                  </p>
                  <TradeSetupDisplay setup={primaryScenario.trade_setup_asociado} />
                </>
              )}
            </div>
          </>
        )}
        {!primaryScenario && (
          <p className="text-xs sm:text-sm text-slate-400 italic">No se identificó un escenario principal.</p>
        )}
        {alternativeScenarios.length > 0 && (
          <>
            <SectionTitle>Escenarios Alternativos</SectionTitle>
            {alternativeScenarios.map((scenario, index) => (
              <div key={index} className="mt-1.5 sm:mt-2 p-2 sm:p-3 bg-slate-700/70 rounded-md">
                <p className="text-xs sm:text-sm font-semibold text-slate-200">{scenario.nombre_escenario} <span className="text-xs text-slate-400">(Prob: {scenario.probabilidad})</span></p>
                <p className="text-xs text-slate-300 mt-1">{scenario.descripcion_detallada}</p>
                {scenario.niveles_clave_de_invalidacion && (
                  <p className="text-xs text-slate-400 mt-1">Invalidación: {scenario.niveles_clave_de_invalidacion}</p>
                )}
                {scenario.trade_setup_asociado && scenario.trade_setup_asociado.tipo !== "ninguno" && (
                  <>
                    <p className="text-xs font-semibold text-slate-100 mt-1.5 sm:mt-2">
                      Trade Potencial: <span className={scenario.trade_setup_asociado.tipo === 'largo' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{scenario.trade_setup_asociado.tipo.toUpperCase()}</span>
                    </p>
                    <TradeSetupDisplay setup={scenario.trade_setup_asociado} />
                  </>
                )}
              </div>
            ))}
          </>
        )}
        <>
          <SectionTitle>Señal Activa Sugerida</SectionTitle>
          <p className={`text-xs sm:text-sm font-semibold ${activeSignalColorClass}`}>
            {activeSignalType && activeSignalType !== "ninguno" ? activeSignalType.toUpperCase() : "NINGUNA"}
          </p>
          {analysisResult?.proyeccion_precio_visual && (analysisResult.proyeccion_precio_visual.camino_probable_1 || analysisResult.proyeccion_precio_visual.descripcion_camino_1) && (
            <> <SectionTitle>Proyección de Precio</SectionTitle>
              {analysisResult.proyeccion_precio_visual.descripcion_camino_1 && <p className="text-xs sm:text-sm text-slate-300 mb-1">{analysisResult.proyeccion_precio_visual.descripcion_camino_1}</p>}
              {analysisResult.proyeccion_precio_visual.camino_probable_1 && (
                <p className="text-xs text-slate-400">Ruta: {analysisResult.proyeccion_precio_visual.camino_probable_1.map(p => typeof p === 'number' && p != null ? `$${p.toFixed(Math.abs(p) < 1 ? 4 : 2)}` : p).join(' → ')}</p>
              )} </>)}
          <SectionTitle>Configuración de Trade Recomendada</SectionTitle>
          <TradeSetupDisplay setup={analysisResult?.conclusion_recomendacion?.mejor_oportunidad_actual} />          <SectionTitle>Análisis Fibonacci</SectionTitle>
          <FibonacciAnalysisDisplay
            fiboAnalysis={analysisResult?.analisis_fibonacci}
            showLTFFibonacci={showLTFFibonacci}
            onShowLTFFibonacciChange={onShowLTFFibonacciChange}
          />
        </>
        {/* Nueva sección de análisis contextual */}
        {analysisResult?.analisis_contextual && (
          <>
            <SectionTitle>Análisis Contextual</SectionTitle>
            <div className="space-y-1.5 mt-1.5 p-2 bg-slate-700 rounded-md">
              {analysisResult.analisis_contextual?.correlacion_mercado && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-200 mb-1">Correlaciones de Mercado:</h4>
                  <p className="text-xs text-slate-300">{analysisResult.analisis_contextual.correlacion_mercado}</p>
                </div>
              )}
              {analysisResult.analisis_contextual?.liquidez_sesiones && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-200 mb-1">Liquidez de Sesiones:</h4>
                  <p className="text-xs text-slate-300">{analysisResult.analisis_contextual.liquidez_sesiones}</p>
                </div>
              )}
              {analysisResult.analisis_contextual?.comentario_funding_rate_oi && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-200 mb-1">Funding Rate y Open Interest:</h4>
                  <p className="text-xs text-slate-300">{analysisResult.analisis_contextual.comentario_funding_rate_oi}</p>
                </div>
              )}
            </div>
          </>
        )}
        {analysisResult?.puntos_clave_grafico && analysisResult.puntos_clave_grafico.length > 0 && (
          <> <SectionTitle>Niveles y Zonas Clave Identificados</SectionTitle>
            <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-slate-300 mt-1.5 sm:mt-2 p-1.5 sm:p-2 bg-slate-700 rounded-md">
              {analysisResult.puntos_clave_grafico.map((point, index) => (
                <li key={index}>
                  <span className="font-medium text-slate-100">{point?.label || 'Nivel sin nombre'}</span>
                  {point?.tipo && <span className="text-xs text-slate-400"> ({point.tipo.replace(/_/g, ' ')})</span>}
                  {point?.zona && point.zona[0] != null && point.zona[1] != null && <span className="text-xs text-slate-400"> [$${point.zona[0].toFixed(Math.abs(point.zona[0]) < 1 ? 4 : 2)} - $${point.zona[1].toFixed(Math.abs(point.zona[1]) < 1 ? 4 : 2)}]</span>}
                  {point?.nivel != null && <span className="text-xs text-slate-400"> @ ${typeof point.nivel === 'number' ? point.nivel.toFixed(Math.abs(point.nivel) < 1 ? 4 : 2) : point.nivel}</span>}
                  {point?.temporalidad && <span className="text-xs text-slate-500"> ({point.temporalidad})</span>}
                  {(point?.tipo === AnalysisPointType.POI_DEMANDA || point?.tipo === AnalysisPointType.POI_OFERTA) && point?.mitigado && <span className="text-xs text-sky-300"> (Mitigado)</span>}
                  {point?.importancia && <span className="text-xs text-yellow-400"> Importancia: {point.importancia}</span>}
                </li>))} </ul> </>)}
        <SectionTitle>Estructura General de Mercado y Volumen</SectionTitle>
        {analysisResult.analisis_general?.estructura_mercado_resumen && Object.entries(analysisResult.analisis_general.estructura_mercado_resumen).map(([tf, desc]) =>
          desc && <DetailItem key={tf} label={`Estructura (${tf.replace('htf_', '').replace('mtf_', '').replace('ltf_', '')})`} value={desc as string} />)}
        <DetailItem label="Fase Wyckoff" value={analysisResult.analisis_general?.fase_wyckoff_actual} />
        <DetailItem label="Sesgo General" value={analysisResult.analisis_general?.sesgo_direccional_general?.toUpperCase()} valueClassName={biasColorClass + " font-semibold"} />
        {analysisResult.analisis_general?.comentario_volumen && (
          <p className="text-xs sm:text-sm text-slate-300 mt-1"><span className="font-medium text-slate-100">Comentario Breve de Volumen:</span> {analysisResult.analisis_general.comentario_volumen}</p>)}
        {analysisResult.analisis_general?.interpretacion_volumen_detallada && (
          <p className="text-xs sm:text-sm text-slate-300 mt-1"><span className="font-medium text-slate-100">Análisis Detallado de Volumen:</span> {analysisResult.analisis_general.interpretacion_volumen_detallada}</p>)}
        {analysisResult.analisis_general?.comentario_funding_rate_oi && (
          <> <SectionTitle>Análisis Conceptual FR/OI</SectionTitle>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 mb-1.5 sm:mb-2 p-2 sm:p-3 bg-slate-700 rounded-md">
              {analysisResult.analisis_general.comentario_funding_rate_oi} </p> </>)}
        <SectionTitle>Conclusión y Recomendaciones</SectionTitle>
        {analysisResult.conclusion_recomendacion?.resumen_ejecutivo && (
          <p className="text-xs sm:text-sm text-slate-300 mt-1 mb-1.5 sm:mb-2 p-2 sm:p-3 bg-slate-700 rounded-md">{analysisResult.conclusion_recomendacion.resumen_ejecutivo}</p>)}
        <DetailItem label="Próximo Movimiento Esperado" value={analysisResult.conclusion_recomendacion?.proximo_movimiento_esperado} />
        {analysisResult.conclusion_recomendacion?.oportunidades_reentrada_detectadas && (
          <> <h4 className="text-sm font-semibold mt-2 mb-1 text-sky-300">Oportunidades de Reentrada:</h4>
            <p className="text-xs sm:text-sm text-slate-300 p-2 bg-slate-700/70 rounded-md">{analysisResult.conclusion_recomendacion.oportunidades_reentrada_detectadas}</p> </>)}
        {analysisResult.conclusion_recomendacion?.consideraciones_salida_trade && (
          <> <h4 className="text-sm font-semibold mt-2 mb-1 text-sky-300">Consideraciones de Salida:</h4>
            <p className="text-xs sm:text-sm text-slate-300 p-2 bg-slate-700/70 rounded-md">{analysisResult.conclusion_recomendacion.consideraciones_salida_trade}</p> </>)}
        {analysisResult.conclusion_recomendacion?.senales_confluencia_avanzada && (
          <> <h4 className="text-sm font-semibold mt-2 mb-1 text-sky-300">Señales Avanzadas de Confluencia (Conceptual):</h4>
            <p className="text-xs sm:text-sm text-slate-300 p-2 bg-slate-700/70 rounded-md">{analysisResult.conclusion_recomendacion.senales_confluencia_avanzada}</p> </>)}
        <DetailItem label="Advertencias/Riesgos" value={analysisResult.conclusion_recomendacion?.advertencias_riesgos} />
      </div>
    );
  };

  const renderChatContent = () => {
    const chatContainerBg = theme === 'dark' ? 'bg-slate-800' : 'bg-white';
    const chatTextColor = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
    const inputBgColor = theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100';
    const inputBorderColor = theme === 'dark' ? 'border-slate-600' : 'border-gray-300';
    const buttonBgColor = theme === 'dark' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-sky-500 hover:bg-sky-600';
    const userMessageBg = theme === 'dark' ? 'bg-sky-700' : 'bg-sky-500';
    const aiMessageBg = theme === 'dark' ? 'bg-slate-600' : 'bg-gray-200';
    const aiMessageText = theme === 'dark' ? 'text-slate-50' : 'text-slate-800';

    return (
      <div className={`flex flex-col h-full ${chatContainerBg} ${chatTextColor}`}>
        <div className={`flex justify-between items-center p-3 sm:p-4 border-b ${inputBorderColor} flex-shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white`}>
          <div className="flex items-center gap-3">
            {/* TradeGuru AI Image */}
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 4c3.31 0 6 2.69 6 6v8h-2v-2H8v2H6v-8c0-3.31 2.69-6 6-6zm-3 8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">TradeGuru IA</h2>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${apiKeyPresent ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span className="text-xs text-white/90">{apiKeyPresent ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
          {apiKeyPresent && chatMessages.length > 0 && (
            <button
              onClick={onClearChatHistory}
              className="p-2 rounded-lg transition-colors text-white/80 hover:text-white hover:bg-white/20"
              title="Borrar historial del chat"
              aria-label="Borrar historial del chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c1.153 0 2.243.032 3.223.096M15 5.25a3 3 0 00-3-3m-3 3a3 3 0 01-3-3m-3 3a3 3 0 003 3m3 3a3 3 0 013 3m3 3a3 3 0 003-3" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex-grow p-3 sm:p-4 space-y-3 overflow-y-auto">
          {!apiKeyPresent && (
            <div className="p-3 text-sm text-yellow-300 bg-yellow-800 bg-opacity-50 rounded-lg border border-yellow-600">
              Clave API no configurada. Las funciones de Chat IA están deshabilitadas.
            </div>
          )}
          {apiKeyPresent && chatError && (
            <div className="p-3 text-sm text-red-300 bg-red-800 bg-opacity-50 rounded-lg border border-red-600">
              Error en Chat: {chatError}
            </div>
          )}

          {/* Mensaje de bienvenida cuando no hay mensajes */}
          {chatMessages.length === 0 && apiKeyPresent && !chatError && (
            <div className={`p-4 rounded-lg ${aiMessageBg} ${aiMessageText} border-l-4 border-emerald-500`}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 4c3.31 0 6 2.69 6 6v8h-2v-2H8v2H6v-8c0-3.31 2.69-6 6-6zm-3 8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">¡Hola! Soy TradeGuru IA</p>
                  <p className="text-xs opacity-80 mb-2">
                    Puedo ver y analizar tu gráfico actual en tiempo real. Tengo acceso a:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                      </svg>
                      <span>Gráfico actual</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                      </svg>
                      <span>Niveles y zonas</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                      </svg>
                      <span>Medias móviles</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                      </svg>
                      <span>POIs y FVGs</span>
                    </div>
                  </div>
                  <p className="text-xs opacity-80 mt-2">
                    Pregúntame sobre cualquier aspecto del gráfico o análisis.
                  </p>
                </div>
              </div>
            </div>
          )}

          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-2 sm:p-3 rounded-lg text-xs sm:text-sm shadow ${msg.sender === 'user'
                  ? `${userMessageBg} text-white`
                  : `${aiMessageBg} ${aiMessageText}`
                  }`}
                dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>').replace(/```json\s*\n?(.*?)\n?\s*```/gs, (_, p1) => `<pre class="bg-slate-900 text-slate-100 p-2 rounded overflow-x-auto text-xs">${p1.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim()}</pre>`).replace(/`([^`]+)`/g, '<code class="bg-opacity-50 bg-black text-white px-1 py-0.5 rounded text-xs">$1</code>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }}
              />
            </div>
          ))}
          <div ref={chatMessagesEndRef} />
        </div>

        {chatLoading && (
          <div className={`px-3 sm:px-4 pb-1 text-xs text-center ${theme === 'dark' ? 'text-sky-300' : 'text-sky-600'}`}>
            TradeGuru IA está pensando...
          </div>
        )}

        {/* Sección de input y status */}
        <div className={`p-2 sm:p-3 md:p-4 border-t ${inputBorderColor} flex-shrink-0`}>
          <div className="flex items-start space-x-2">
            <textarea
              ref={chatInputRef}
              value={chatInputValue}
              onChange={(e) => setChatInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSend();
                }
              }}
              placeholder={apiKeyPresent ? "Pregúntame sobre trading..." : "Se requiere Clave API para el chat"}
              className={`flex-grow p-2 sm:p-2.5 border rounded-md shadow-sm text-xs sm:text-sm resize-none ${inputBgColor} ${chatTextColor} ${inputBorderColor} focus:ring-sky-500 focus:border-sky-500`}
              rows={2}
              disabled={chatLoading || !apiKeyPresent || (!!chatError && chatMessages.length === 0)}
              aria-label="Entrada de mensaje de chat"
            />
            <button
              onClick={handleChatSend}
              disabled={chatLoading || !chatInputValue.trim() || !apiKeyPresent || (!!chatError && chatMessages.length === 0)}
              className={`px-2 py-2 sm:px-3 sm:py-2.5 text-white font-semibold rounded-md shadow-sm text-xs sm:text-sm ${buttonBgColor} disabled:bg-slate-500 disabled:cursor-not-allowed`}
              aria-label="Enviar mensaje"
            >
              <span className="hidden sm:inline">Enviar</span>
              <span className="sm:hidden">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </span>
            </button>
          </div>

          {/* Status section */}
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${apiKeyPresent ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-xs text-slate-400">Con Visión del Gráfico</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-400">{apiKeyPresent ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (panelMode === 'initial') {
    return (
      <StatusDisplayWrapper title="Panel de IA">
        Selecciona "Análisis IA" para un análisis técnico o "Asistente IA" para chatear.
      </StatusDisplayWrapper>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {panelMode === 'analysis' ? renderAnalysisContent() : renderChatContent()}
    </div>
  );
};

export default AnalysisPanel;
