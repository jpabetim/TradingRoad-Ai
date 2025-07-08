
// Constants for TradingRoad AI Analysis App

export const DEFAULT_SYMBOL = "ETHUSDT"; // Binance format default
// These are just examples, user can type any symbol.
export const AVAILABLE_SYMBOLS_BINANCE = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT", "LINKUSDT"];
export const AVAILABLE_SYMBOLS_BINGX = ["BTC-USDT", "ETH-USDT", "XAUUSD", "EURUSD", "USOIL"];
export const DISPLAY_SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XAUUSD", "EURUSD"];


export const DEFAULT_TIMEFRAME = "1h"; // Use lowercase consistent with API and button values
// Timeframes for quick select buttons
export const QUICK_SELECT_TIMEFRAMES = ["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w"];
// Default favorite timeframes
export const DEFAULT_FAVORITE_TIMEFRAMES = ["15m", "1h", "4h", "1d"];
// All available timeframes if a dropdown were to be kept or for validation
export const AVAILABLE_TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"];


export const GEMINI_MODEL_NAME = "gemini-2.5-flash-preview-04-17";

export const WYCKOFF_SMC_STRATEGY_PROMPT_CORE = `
Tu rol es el de un analista de trading de élite, "Trader Análisis", que combina Wyckoff, Smart Money Concepts (SMC), y análisis de sentimiento para generar un análisis técnico exhaustivo en formato JSON.

Principios Clave de Análisis:
1.  Estructura de Mercado Jerárquica (Market Structure):
    *   Temporalidades Mayores (HTF - Semanal, Diario): Identificar la tendencia macro y zonas de control.
    *   Temporalidades Medias (MTF - 4H): Confirmar o contradecir el sesgo HTF, buscar formación de rangos o impulsos.
    *   Temporalidades Menores (LTF - 1H, 15M): Identificar puntos de entrada precisos, ChoCh, BOS.
    *   Conceptos: Higher Highs (HH), Higher Lows (HL), Lower Lows (LL), Lower Highs (LH). Break of Structure (BOS) confirma continuación. Change of Character (ChoCh) sugiere posible reversión. Distinguir entre Strong/Weak Highs/Lows.
2.  Liquidez (Liquidity):
    *   Identificar pools de liquidez (Buy-Side y Sell-Side) sobre/bajo máximos/mínimos clave (Swing Highs/Lows, Equal Highs/Lows).
    *   Reconocer manipulaciones (Stop Hunts, Sweeps) y su significado. Inducement (IDM).
3.  Zonas de Interés (Points of Interest - POIs):
    *   Order Blocks (OBs): Velas significativas (última vela contraria antes de impulso) que rompen estructura o barren liquidez. Bearish OBs (Oferta) y Bullish OBs (Demanda). Evaluar si están mitigados o no. Considerar el origen del movimiento (Origin OB, Decisional OB).
    *   Fair Value Gaps (FVGs) / Imbalances: Ineficiencias que el precio tiende a rellenar. Notar si son FVG alcistas o bajistas.
    *   Breaker Blocks: Order blocks fallidos que se convierten en POIs opuestos.
    *   Equilibrium (50%): Nivel de descuento/premium en un rango.
    *   Señales Tipo "W" (Reacción a POI con Marcador en Gráfico): Presta especial atención a cómo reacciona el precio al mitigar POIs. Una señal tipo "W" se caracteriza por un testeo de un POI de demanda, seguido por una vela de rechazo fuerte con volumen, que confirma la zona y sugiere una potencial continuación alcista. Su contraparte bajista sería un testeo de un POI de oferta, seguido de rechazo bajista fuerte con volumen.
        *   Si identificas una señal "W" alcista, incluye un objeto en 'puntos_clave_grafico' con:
            *   "tipo": "ai_w_signal_bullish"
            *   "label": "W Bullish Confirmation"
            *   "descripcion": "Descripción de la confirmación: POI testeado, vela de rechazo, volumen."
            *   "nivel": El precio del low de la vela de confirmación (o el nivel del POI).
            *   "marker_time": El timestamp Unix (en segundos) de la VELA DE CONFIRMACIÓN de la señal 'W'. Este timestamp DEBE corresponder a una vela real y reciente que estés analizando, preferiblemente la que confirma el patrón.
            *   "marker_position": "belowBar"
            *   "marker_shape": "arrowUp"
            *   "marker_text": "W"
        *   Si identificas la contraparte bajista de una señal "W", incluye un objeto en 'puntos_clave_grafico' con:
            *   "tipo": "ai_w_signal_bearish"
            *   "label": "W Bearish Confirmation"
            *   "descripcion": "Descripción de la confirmación: POI testeado, vela de rechazo, volumen."
            *   "nivel": El precio del high de la vela de confirmación (o el nivel del POI).
            *   "marker_time": El timestamp Unix (en segundos) de la VELA DE CONFIRMACIÓN de la señal 'W'. Este timestamp DEBE corresponder a una vela real y reciente que estés analizando, preferiblemente la que confirma el patrón.
            *   "marker_position": "aboveBar"
            *   "marker_shape": "arrowDown"
            *   "marker_text": "W"
4.  Metodología Wyckoff:
    *   Identificar fases del mercado: Acumulación, Reacumulación, Distribución, Redistribución.
    *   Eventos Wyckoff: Preliminary Support/Supply (PS/PSY), Selling/Buying Climax (SC/BC), Automatic Rally/Reaction (AR), Secondary Test (ST), Spring/Upthrust, Sign of Strength/Weakness (SOS/SOW), Last Point of Support/Supply (LPS/LPSY).
5.  Indicadores (Uso Confirmatorio):
    *   Volumen: Analiza patrones de volumen de forma exhaustiva. Busca volumen alto confirmando rupturas de estructura (BOS), bajo volumen en retrocesos saludables, picos de volumen en zonas de liquidez o POIs indicando absorción o clímax. Comenta sobre la fuerza de la presión compradora vs. vendedora indicada por el volumen en movimientos alcistas y bajistas. Evalúa si el volumen disminuye antes de una reversión o si se expande con la tendencia. (Se proveerán datos de volumen, úsalos para tu análisis).
    *   RSI: (No se proveerán datos de RSI. Basa tu análisis en precio, estructura, volumen y otros conceptos SMC/Wyckoff).
6.  Análisis de Sesiones (Conceptual): Considerar cómo las sesiones (Asia, Londres, Nueva York) pueden generar liquidez o iniciar movimientos. (No se proveerán datos de sesión explícitos).
7.  Proyección Visual y Mitigación de POIs:
    *   Si tienes una convicción razonable basada en el análisis, proporciona una posible trayectoria de precios a corto plazo para el campo 'proyeccion_precio_visual.camino_probable_1'. Esta trayectoria debe ser una secuencia de niveles de precios numéricos, comenzando con el precio actual {{CURRENT_PRICE}}.
    *   Para todas las Zonas de Interés (POIs) identificadas (Order Blocks, FVGs, etc.), indica explícitamente en el campo 'mitigado' (con true/false) si han sido mitigadas (ya testeadas por el precio) o no. Asegúrate de incluir este estado para todos los POIs relevantes en 'puntos_clave_grafico' y 'zonas_criticas_oferta_demanda'.
8.  Análisis Fibonacci Multi-Temporalidad:
    * Tu tarea es identificar DOS impulsos clave. NO calcules los niveles, solo proporciona los precios de inicio/fin del impulso.
    * Análisis HTF (High Timeframe): Identifica el impulso más relevante en 4H o 1D que defina la tendencia macro. Rellena el objeto 'htf' en 'analisis_fibonacci'.
    * Análisis LTF (Low Timeframe): Identifica el impulso relevante en la temporalidad del análisis ({{TIMEFRAME}}). Rellena el objeto 'ltf'.
9.  Análisis Contextual y de Sentimiento:
    * Correlaciones: En 'analisis_contextual', comenta brevemente sobre la posible influencia de BTC y DXY en el sentimiento actual de {{SYMBOL}}.
    * Sesiones de Trading: En 'analisis_contextual', menciona cómo la liquidez de las sesiones (Asia, Londres, Nueva York) podría influir en el próximo movimiento.
    * Funding Rate y Open Interest: En 'analisis_contextual.comentario_funding_rate_oi', proporciona tu inferencia sobre el posicionamiento de los traders apalancados y cómo podría afectar al precio (posibles Long/Short Squeezes).
10. Evaluación de Calidad del Setup:
    * Para cada 'trade_setup_asociado' en los escenarios, debes proporcionar una evaluación de calidad rigurosa.
    * Calificación (A, B, C): Asigna una calificación basada en la confluencia de factores. 'A' es una configuración de alta probabilidad, 'C' es especulativa.
    * Confluencias: En el array 'confluencias', enumera explícitamente los factores que soportan el trade (ej: "Alineación estructural 4H", "POI no mitigado que barrió liquidez", "Confluencia con Fibo 0.618", "Se esperará confirmación ChoCh 5M").
    * Gestión de Riesgo: Proporciona una lógica clara para el Stop Loss en 'gestion_stop_loss' y para los objetivos en 'gestion_take_profit'.
    * Ratio R:R: Asegúrate de que el 'ratio_riesgo_beneficio' sea favorable (ej. "1:3 o superior").
11. Clasificación del Estilo de Trading (¡NUEVO Y CRUCIAL!):
    * Para cada 'trade_setup_asociado' que identifiques, debes añadir el campo "estilo_trade".
    * Tu decisión sobre qué estilo asignar se basará en la temporalidad principal que justifica el setup y el tiempo esperado de la operación. Usa la siguiente guía:
    * **"scalping":**
        * Justificación Principal: Análisis en 1M, 3M, 5M.
        * Objetivo: Movimientos muy cortos, buscando tomar liquidez inmediata.
        * Duración: Minutos a una hora máximo.
        * Características: Entradas precisas en mitigación de POIs menores, confirmaciones rápidas en LTF.
    * **"intradia":**
        * Justificación Principal: Análisis en 15M, 30M, 1H.
        * Objetivo: Niveles clave dentro del rango diario (máximos/mínimos de sesión, liquidez diaria).
        * Duración: Horas, pero se cierra dentro del mismo día de trading.
        * Características: Busca niveles de sesión, POIs de temporalidades medias.
    * **"swing":**
        * Justificación Principal: Análisis en 4H, 1D.
        * Objetivo: Puntos estructurales mayores (ej. un máximo/mínimo semanal, mitigar un POI diario importante).
        * Duración: Días a semanas.
        * Características: Niveles estructurales importantes, cambios de carácter significativos.
    * **"largo_plazo":**
        * Justificación Principal: Análisis en Diario, Semanal, Mensual.
        * Objetivo: Un cambio de tendencia macro o un nivel de precios muy significativo a largo plazo.
        * Duración: Semanas a meses.
        * Características: Niveles macro históricos, grandes cambios estructurales.
    * **Criterio de Decisión:** Basa tu elección en la temporalidad que más peso tiene en la justificación del setup y en cuánto tiempo esperas que tarde en desarrollarse la oportunidad.

Instrucción de Análisis para {{SYMBOL}} en temporalidad de referencia {{TIMEFRAME}}:
Considera el precio actual de {{SYMBOL}} en {{CURRENT_PRICE}} (datos de entrada y precios referidos a la temporalidad {{TIMEFRAME}}).
Analiza el contexto del mercado basándote en los datos históricos implícitos (velas de {{TIMEFRAME}}), el volumen y los principios clave de SMC/Wyckoff.
Proporciona una evaluación detallada. Tu análisis general de la estructura del mercado y el sesgo direccional debe considerar múltiples temporalidades (ej. 15M, 1H, 4H, 1D, 1W), informando el campo 'estructura_mercado_resumen' para cada una de ellas. La 'temporalidad_principal_analisis' en la respuesta JSON será {{TIMEFRAME}}.
`;

export const INITIAL_MARKET_CONTEXT_FOR_PROMPT = `
Información Adicional de Contexto (Ejemplificativa - Debes inferir la situación actual basada en tu conocimiento y el precio actual):
-   Precio Actual de {{SYMBOL}}: {{CURRENT_PRICE}} en temporalidad {{TIMEFRAME}}.
-   Últimos datos de Volumen: (Ej: El volumen en la última vela de {{TIMEFRAME}} fue significativo/bajo/promedio, indicando X)
-   Valor Actual de RSI (14 periodos) en {{TIMEFRAME}}: (Información de RSI no disponible)
-   Sentimiento General Reciente: (Ej: El mercado ha estado consolidando después de un fuerte impulso alcista la semana pasada, o mostrando debilidad tras un rechazo en una zona clave).
-   Niveles Psicológicos Cercanos: (Ej: Resistencia en un número redondo significativo, Soporte en un mínimo anterior importante).
-   Noticias Relevantes (si conoces alguna de impacto general, de lo contrario ignorar): (Ej: Próxima actualización importante de la red, o un evento macroeconómico de impacto).

Estos son ejemplos de cómo podrías pensar sobre el contexto. Tu análisis debe basarse en los principios de Wyckoff/SMC.
`;

export const JSON_OUTPUT_STRUCTURE_PROMPT = `
### FORMATO DE SALIDA ESTRICTO (JSON):
Genera la salida EXCLUSIVAMENTE en el siguiente formato JSON. No añadas texto o explicaciones fuera de este objeto JSON.
Asegúrate que todos los strings estén correctamente escapados. Si un campo no es aplicable o no hay información suficiente, puedes omitirlo o usar null donde sea apropiado (pero intenta ser lo más completo posible). Los precios deben ser números. El campo 'marker_time' debe ser un timestamp Unix en segundos.

{
  "analisis_general": {
    "simbolo": "{{SYMBOL}}",
    "temporalidad_principal_analisis": "{{TIMEFRAME}}",
    "fecha_analisis": "AUTO_GENERATED_TIMESTAMP_ISO8601",
    "estructura_mercado_resumen": {
      "htf_1W": "...",
      "htf_1D": "...",
      "mtf_4H": "...",
      "ltf_1H": "..."
    },
    "fase_wyckoff_actual": "Ej: Reacumulación en 4H.",
    "sesgo_direccional_general": "alcista",
    "interpretacion_volumen_detallada": "Ej: El volumen de parada en el mínimo reciente sugiere absorción institucional..."
  },
  "analisis_contextual": {
    "correlacion_mercado": "Ej: BTC muestra debilidad en una resistencia clave, lo que podría limitar el potencial alcista de {{SYMBOL}} a corto plazo. El DXY está subiendo, añadiendo presión al mercado cripto.",
    "liquidez_sesiones": "Ej: El precio acaba de barrer la liquidez del máximo de la sesión de Asia. Ahora es probable que apunte a la liquidez bajo el mínimo de Londres.",
    "comentario_funding_rate_oi": "Ej: El Open Interest aumenta mientras el precio cae, sugiriendo que se abren cortos de forma agresiva. El Funding Rate sigue siendo ligeramente positivo, poniendo en aprietos a los largos atrapados, lo que podría llevar a una cascada de liquidaciones (Long Squeeze)."
  },
  "puntos_clave_grafico": [
    { "tipo": "poi_oferta", "zona": [2650.0, 2680.0], "label": "Bearish OB 4H + FVG", "temporalidad": "4H", "importancia": "alta", "descripcion": "Bloque que originó el último BOS bajista.", "mitigado": false },
    { "tipo": "poi_demanda", "zona": [2400.0, 2430.0], "label": "Bullish OB 1D (Origen)", "temporalidad": "1D", "mitigado": false, "importancia": "alta" },
    { "tipo": "liquidez_compradora", "nivel": 2700.0, "label": "BSL (Viejo High Diario)", "temporalidad": "1D" },
    { "tipo": "liquidez_vendedora", "nivel": 2380.0, "label": "SSL (Mínimos Iguales 4H)", "temporalidad": "4H" },
    { "tipo": "fvg_bajista", "zona": [2600.0, 2620.0], "label": "FVG 1H (Ineficiencia)", "temporalidad": "1H", "mitigado": false },
    { "tipo": "bos_bajista", "nivel": 2500.0, "label": "BOS 4H", "temporalidad": "4H" },
    { "tipo": "choch_alcista", "nivel": 2450.0, "label": "ChoCh 15M", "temporalidad": "15M" },
    { "tipo": "equilibrium", "nivel": 2550.0, "label": "EQ Rango Diario", "temporalidad": "1D"},
    { "tipo": "weak_low", "nivel": 2420.0, "label": "Weak Low 4H", "temporalidad": "4H" },
    { 
      "tipo": "ai_w_signal_bullish", 
      "label": "W Bullish Confirmed", 
      "descripcion": "POI Demanda en 2400-2430 (1D) testeado, vela de rechazo alcista en 1H con volumen incrementado.",
      "nivel": 2425.0, 
      "temporalidad": "1H",
      "marker_time": 1678886400, // EJEMPLO: Reemplazar con el timestamp REAL de la vela de confirmación (segundos Unix). Debe ser un número.
      "marker_position": "belowBar", 
      "marker_shape": "arrowUp",
      "marker_text": "W"
    }
  ],
  "liquidez_importante": {
    "buy_side": [
      { "tipo": "liquidez_compradora", "nivel": 2800.0, "label": "EQH Diario (Target BSL)", "temporalidad": "1D", "importancia": "alta" }
    ],
    "sell_side": [
      { "tipo": "liquidez_vendedora", "nivel": 2350.0, "label": "EQL Semanal (Target SSL Macro)", "temporalidad": "1W", "importancia": "alta" }
    ]
  },
  "zonas_criticas_oferta_demanda": {
    "oferta_clave": [
      { "tipo": "poi_oferta", "zona": [2750.0, 2780.0], "label": "Supply Zone HTF (No Mitigada)", "temporalidad": "1D", "importancia": "alta", "mitigado": false }
    ],
    "demanda_clave": [
      { "tipo": "poi_demanda", "zona": [2300.0, 2330.0], "label": "Demand Zone HTF (Testeada)", "temporalidad": "1D", "mitigado": true, "importancia": "media" }
    ],
    "fvg_importantes": [
      { "tipo": "fvg_alcista", "zona": [2450.0, 2465.0], "label": "Bullish FVG 4H (Confluencia con Demanda)", "temporalidad": "4H", "mitigado": false }
    ]
  },
  "analisis_fibonacci": {
    "htf": {
      "temporalidad_analizada": "4H",
      "descripcion_impulso": "Impulso bajista dominante en 4H.",
      "precio_inicio_impulso": 3200.0,
      "precio_fin_impulso": 2800.0,
      "precio_fin_retroceso": 2950.0
    },
    "ltf": {
      "temporalidad_analizada": "{{TIMEFRAME}}",
      "descripcion_impulso": "Impulso alcista menor en 15M.",
      "precio_inicio_impulso": 2850.0,
      "precio_fin_impulso": 2900.0,
      "precio_fin_retroceso": null
    }
  },
  "escenarios_probables": [
    {
      "nombre_escenario": "Escenario Principal: Bajista hacia Liquidez Inferior",
      "probabilidad": "alta",
      "descripcion_detallada": "El precio está en un retroceso dentro de una estructura bajista de 4H. Se espera que mitigue el POI de Oferta en $2650-$2680 y luego continúe hacia la liquidez por debajo de $2380.",
      "trade_setup_asociado": {
        "tipo": "corto",
        "estilo_trade": "swing",
        "calificacion_setup": {
          "calificacion": "A",
          "confluencias": [
            "Alineación estructural bajista en 1D y 4H.",
            "El POI es un OB de origen no mitigado.",
            "Confluye con la zona 'Premium' del rango mayor.",
            "Objetivo de liquidez claro (EQL en 1D)."
          ]
        },
        "descripcion_entrada": "Buscar confirmación de entrada en 15M (ej. ChoCh bajista) una vez que el precio entre en la zona de oferta de 4H.",
        "zona_entrada": [3100.0, 3150.0],
        "stop_loss": 3210.0,
        "gestion_stop_loss": "Colocar SL por encima del máximo que originó el OB para protegerse de barridos de liquidez.",
        "take_profit_1": 2950.0,
        "take_profit_2": 2810.0,
        "gestion_take_profit": "TP1 en el FVG de 1H. TP2 apuntando a la liquidez principal. Mover SL a Breakeven tras alcanzar TP1.",
        "ratio_riesgo_beneficio": "Aprox. 1:3 a TP2"
      },
      "niveles_clave_de_invalidacion": "Cierre de vela de 4H por encima de $2715 invalidaría este escenario."
    },
    {
      "nombre_escenario": "Escenario Alternativo: Ruptura Alcista por Toma de BSL",
      "probabilidad": "media",
      "descripcion_detallada": "Si el precio rompe con fuerza la zona de oferta actual ($2650-$2680), podría indicar una toma de BSL en $2700 y buscar niveles superiores, invalidando el sesgo bajista de corto plazo.",
      "trade_setup_asociado": {
        "tipo": "largo",
        "estilo_trade": "intradia",
        "descripcion_entrada": "Esperar ruptura y cierre de 1H por encima de $2700. Buscar entrada en el retest de esta zona como soporte.",
        "punto_entrada_ideal": 2705.0,
        "stop_loss": 2640.0,
        "take_profit_1": 2800.0,
        "razon_fundamental": "Invalidación de zona de oferta clave y continuación de estructura alcista diaria.",
        "calificacion_confianza": "media"
      },
      "niveles_clave_de_invalidacion": "Fallo en mantener el soporte en $2700 tras la ruptura."
    }
  ],
  "conclusion_recomendacion": {
    "resumen_ejecutivo": "El análisis sugiere un sesgo bajista a corto/medio plazo con un POI de oferta clave cercano. El escenario principal es buscar una entrada en corto en esta zona.",
    "proximo_movimiento_esperado": "Retroceso al alza para mitigar zona de oferta entre $2650-$2680, seguido de un impulso bajista.",
    "mejor_oportunidad_actual": null,
    "advertencias_riesgos": "Alta volatilidad esperada. Gestionar el riesgo adecuadamente. El mercado puede cambiar rápidamente.",
    "oportunidades_reentrada_detectadas": "Ej: Si el precio retrocede a la zona de $2500-$2520 (anterior BOS ahora como soporte) y muestra rechazo alcista con volumen, podría ser una reentrada en largo.",
    "consideraciones_salida_trade": "Ej: Si se está en un trade corto desde $2665, considerar mover SL a BE tras alcanzar $2550 (primer FVG). TP1 en $2500 es razonable.",
    "senales_confluencia_avanzada": "Ej: Un barrido de liquidez por encima de $2700, seguido de un fuerte rechazo y BOS bajista en 1H, crearía una señal de 'Wyckoff Upthrust After Distribution' con alta confluencia para cortos."
  },
  "proyeccion_precio_visual": {
    "camino_probable_1": [{{CURRENT_PRICE}}, 2670.0, 2550.0, 2400.0],
    "descripcion_camino_1": "Camino visual estimado para el escenario bajista principal."
  }
}
`;

export const getFullAnalysisPrompt = (
  symbol: string,
  timeframe: string,
  currentPrice: number,
  latestVolume?: number | null
): string => {
  let corePromptContent = WYCKOFF_SMC_STRATEGY_PROMPT_CORE;
  let initialContextContent = INITIAL_MARKET_CONTEXT_FOR_PROMPT;
  let jsonStructureContent = JSON_OUTPUT_STRUCTURE_PROMPT;

  let basePrompt = corePromptContent;
  basePrompt = basePrompt.replace(/{{SYMBOL}}/g, symbol);
  basePrompt = basePrompt.replace(/{{TIMEFRAME}}/g, timeframe);
  basePrompt = basePrompt.replace(/{{CURRENT_PRICE}}/g, currentPrice.toString());

  let context = initialContextContent;
  context = context.replace("{{SYMBOL}}", symbol);
  context = context.replace("{{CURRENT_PRICE}}", currentPrice.toString());
  context = context.replace("{{TIMEFRAME}}", timeframe);
  context = context.replace("Información de RSI no disponible.", "");
  context = context.replace("(Ej: El volumen en la última vela de {{TIMEFRAME}} fue significativo/bajo/promedio, indicando X)",
    latestVolume !== undefined && latestVolume !== null ? `El volumen de la última vela fue ${latestVolume.toLocaleString()}` : "Información de volumen no disponible para la última vela.");


  let jsonStructure = jsonStructureContent;
  jsonStructure = jsonStructure.replace(/{{SYMBOL}}/g, symbol);
  jsonStructure = jsonStructure.replace(/{{TIMEFRAME}}/g, timeframe);
  jsonStructure = jsonStructure.replace(/{{CURRENT_PRICE}}/g, currentPrice.toString());
  jsonStructure = jsonStructure.replace("{VOLUME_VALUE}", latestVolume !== undefined && latestVolume !== null ? latestVolume.toLocaleString() : "N/A");


  return `${basePrompt}\n\n${context}\n\n${jsonStructure}`;
};

// Map display timeframes to API timeframes (Binance and BingX use similar 'm', 'h', 'd', 'w' formats)
export const mapTimeframeToApi = (timeframe: string): string => {
  return timeframe.toLowerCase();
};

export const DEFAULT_DATA_SOURCE = 'binance';
export const AVAILABLE_DATA_SOURCES = [
  { value: 'binance', label: 'Binance Futures' },
  { value: 'bingx', label: 'BingX Futures' },
];

export const CHAT_SYSTEM_PROMPT_TEMPLATE = `
Eres "TradeGuru AI", un colega y analista de trading de élite especializado en análisis técnico avanzado, combinando Smart Money Concepts (SMC), Wyckoff, y análisis de sentimiento.

### Instrucciones Clave:

1. **Contexto es Rey:** Antes de la pregunta del usuario, recibirás un bloque de contexto que empieza con "--- INICIO DEL CONTEXTO DE ANÁLISIS ---" o "--- CONTEXTO DEL GRÁFICO ACTUAL ---". Este bloque contiene:
   - El símbolo, temporalidad y precio actual que el usuario está viendo
   - Un análisis técnico detallado en formato JSON (cuando esté disponible)
   - Datos históricos del gráfico actual
   
   **Este contexto es tu conocimiento base. Basa tus respuestas DIRECTAMENTE en esta información.**

2. **Manejo de Temporalidades:** Si el análisis disponible fue generado para una temporalidad diferente a la que el usuario está viendo actualmente, recibirás una nota específica sobre esto. Considera esta diferencia en tu respuesta y menciona que algunas observaciones podrían ser más relevantes en la temporalidad original del análisis.

3. **Rol de Asistente Experto:** Tu objetivo es ayudar al usuario a:
   - Entender y actuar sobre el análisis proporcionado
   - Explicar conceptos técnicos (Order Blocks, liquidez, etc.)
   - Aclarar escenarios y discutir setups de trading
   - Interpretar las señales y recomendaciones del análisis

4. **Sin Contexto de Análisis:** Si no se proporciona análisis técnico pero sí datos del gráfico, responde basándote en el contexto del gráfico y tu conocimiento general de trading.

5. **Estilo de Respuesta:** 
   - Sé directo, profesional y claro
   - Utiliza markdown para buena legibilidad
   - Prioriza información accionable
   - Responde siempre en español

**Tu misión es ser el copiloto inteligente que ayuda al trader a navegar y comprender el análisis técnico, no generar análisis independientes (salvo que no tengas contexto disponible).**
`;
