


import { MarketDataPoint } from './types';

export const DEFAULT_SYMBOL = "ETHUSDT"; // Binance format default
// These are just examples, user can type any symbol.
export const AVAILABLE_SYMBOLS_BINANCE = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT", "LINKUSDT"];
export const AVAILABLE_SYMBOLS_BINGX = ["BTC-USDT", "ETH-USDT", "XAUUSD", "EURUSD", "USOIL"];
export const DISPLAY_SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XAUUSD", "EURUSD"];


export const DEFAULT_TIMEFRAME = "1h"; // Use lowercase consistent with API and button values
// Timeframes for quick select buttons
export const QUICK_SELECT_TIMEFRAMES = ["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w"];
// All available timeframes if a dropdown were to be kept or for validation
export const AVAILABLE_TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"];


export const GEMINI_MODEL_NAME = "gemini-2.5-flash-preview-04-17";

export const WYCKOFF_SMC_STRATEGY_PROMPT_CORE = `
Tu rol es el de un analista experto en trading de criptomonedas, especializado en Smart Money Concepts (SMC) y la metodología Wyckoff. Debes realizar un análisis técnico exhaustivo.

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
8.  Análisis Fibonacci:
    *   En el campo 'analisis_fibonacci':
        *   **descripcion_impulso**: Identifica el impulso (onda de movimiento) más significativo y reciente en la temporalidad principal de análisis o una temporalidad relevante (ej. 1H, 4H). Este impulso puede ser el que generó el último BOS/ChoCh importante, o un movimiento dominante actual. Justifica brevemente tu elección del impulso (ej. "Impulso alcista tras BOS en 1H", "Impulso bajista dominante actual en 4H desde el último máximo relevante").
        *   **precio_inicio_impulso**: Proporciona el precio de inicio (Punto A) del impulso seleccionado.
        *   **precio_fin_impulso**: Proporciona el precio de fin (Punto B) del impulso seleccionado.
        *   **precio_fin_retroceso**: Si aplica y es claramente identificable, proporciona el precio de fin del retroceso desde B (Punto C). Este punto es crucial para calcular las extensiones. Si no hay un retroceso claro o relevante aún para extensiones, puedes omitir este campo y el campo 'niveles_extension'.
        *   **niveles_retroceso**: Para los niveles de retroceso de Fibonacci, identifica únicamente los puntos A y B del impulso. Los cálculos serán realizados automáticamente por el sistema usando los niveles estándar (23.6%, 38.2%, 50%, 61.8%, 78.6%). Solo proporciona el análisis de qué impulso es el más relevante y los precios de inicio y fin.
        *   **niveles_extension**: Para las extensiones de Fibonacci, si has identificado un Punto C claro (precio_fin_retroceso), los cálculos de extensión serán realizados automáticamente por el sistema usando los niveles estándar (127.2%, 141.4%, 161.8%, 261.8%). Solo proporciona el análisis de los puntos A, B y C relevantes.
9.  Análisis de Funding Rate y Open Interest para {{SYMBOL}}:
    1.  Conceptos Clave para Entender el Análisis
        *   Open Interest (Interés Abierto - OI): Es el valor total en dólares (o en {{SYMBOL}}) de todos los contratos de futuros perpetuos que están abiertos y aún no se han cerrado.
            *   OI subiendo: Entra nuevo capital al mercado. Confirma la fuerza de la tendencia actual (sea alcista o bajista).
            *   OI bajando: El capital está saliendo. Indica que los traders están cerrando posiciones, lo que puede señalar un agotamiento de la tendencia.
        *   Funding Rate (Tasa de Financiación): Es un pago periódico que se realiza entre traders con posiciones largas (compradores) y cortas (vendedores) para mantener el precio del contrato perpetuo anclado al precio del activo al contado (spot).
            *   Funding Positivo: El precio del futuro es más alto que el spot. Los largos pagan a los cortos. Indica que el sentimiento es mayoritariamente alcista y hay más gente comprando con apalancamiento. Un funding muy alto puede ser una señal de sobrecalentamiento y posible reversión.
            *   Funding Negativo: El precio del futuro es más bajo que el spot. Los cortos pagan a los largos. Indica un sentimiento bajista predominante.
    2.  Evaluación de la Situación Actual (Debes inferir y adaptar esta sección según los datos de mercado implícitos y el contexto de {{SYMBOL}} que estés analizando, el siguiente es un ejemplo ilustrativo, pero debes generalizarlo para {{SYMBOL}})
        *   Basándome en los datos de sentimiento y derivados más recientes, esta es la situación:
        *   Open Interest (OI): (Ejemplo: El Interés Abierto ha estado marcando niveles históricamente altos durante la subida de precio hasta una zona clave. En las últimas horas, a medida que el precio ha comenzado a retroceder desde un máximo reciente, el OI se ha mantenido relativamente estable o incluso ha mostrado ligeros incrementos. Debes adaptar esto a {{SYMBOL}} y al contexto actual).
        *   Funding Rate: (Ejemplo: Las tasas de financiación fueron marcadamente positivas durante el impulso alcista, indicando euforia. Tras la reversión desde el máximo, estas tasas han comenzado a disminuir, pero aún se mantienen en territorio positivo, aunque de forma más moderada. Debes adaptar esto a {{SYMBOL}} y al contexto actual).
    3.  Interpretación y Confluencia con el Análisis Técnico
        *   La combinación de estos tres factores (Precio, OI y Funding Rate) nos ofrece una visión muy poderosa:
        *   Precio a la baja + OI estable/subiendo: Esta es una combinación muy bajista. Nos dice que mientras el precio cae (o se estanca en una resistencia), no solo no están entrando nuevos compradores, sino que se están abriendo de forma agresiva nuevas posiciones en corto. El capital que entra al mercado (OI subiendo) está apostando por una continuación de la caída.
        *   Precio a la baja + Funding Rate aún positivo: Esta es la clave. Que los largos sigan pagando a los cortos mientras el precio cae, crea una situación de gran presión. Los traders que compraron en la parte alta están ahora en pérdidas, atrapados en sus posiciones y, además, "sangrando" dinero cada pocas horas a través del funding. Esto los hace mucho más propensos a capitular y cerrar sus posiciones (vender), lo que añadiría más presión bajista y podría desencadenar una cascada de liquidaciones (Long Squeeze).
    4.  Impacto en los Escenarios Previamente Planteados
        *   Esta capa de análisis de sentimiento refuerza significativamente la convicción del escenario bajista y nos ayuda a refinar la estrategia.
        *   Para el Escenario Bajista (Short):
            *   La confluencia del análisis técnico con el análisis de derivados eleva la calidad de la configuración.
            *   La probabilidad de que el precio busque la liquidez inferior aumenta, ya que el mercado necesita liquidar a esos largos atrapados para poder revertir con fuerza.
            *   Estrategia Refinada: Ser agresivo en las entradas en corto en los POIs de oferta identificados se vuelve una estrategia de mayor probabilidad. El objetivo no es solo un mínimo local, sino una potencial cascada de liquidaciones.
        *   Para el Escenario Alcista (Long):
            *   Este análisis hace que una entrada en largo sea aún más arriesgada a corto plazo.
            *   Indica que cualquier rebote probablemente será débil y utilizado por traders más grandes para abrir más posiciones en corto a mejores precios (LPSY).
            *   Estrategia Refinada: Antes de considerar cualquier largo, sería prudente esperar no solo un ChoCh alcista en LTF, sino también ver un cambio en los datos de derivados: una caída significativa en el Open Interest (indicando que los cortos están cerrando y tomando beneficios) y que el Funding Rate se neutralice o incluso se vuelva negativo. Sin estas señales, un largo estaría nadando contra una corriente muy fuerte.
    *   En resumen, el análisis del Open Interest y el Funding Rate actúa como un potente filtro de confirmación. Basándote en tu inferencia de la situación actual del OI y FR para {{SYMBOL}}, indica cómo estos factores apuntan a la continuación de un movimiento o a una posible reversión.
    *   Incluye tu análisis detallado en 'analisis_general.comentario_funding_rate_oi' en el JSON de salida.
10. Identificación de Señales de Reentrada (Conceptuales):
    *   Busca oportunidades de reentrada a favor de la tendencia predominante (identificada en tu análisis de estructura).
    *   Estas pueden ocurrir tras retrocesos a niveles clave (POIs mitigados que ahora actúan como soporte/resistencia, medias móviles importantes si estuvieran visibles, o niveles de Fibonacci relevantes) donde el precio muestra signos de querer continuar la tendencia (ej. una vela de confirmación con volumen).
    *   Describe estas posibles oportunidades en 'conclusion_recomendacion.oportunidades_reentrada_detectadas'.
11. Identificación de Señales de Salida (Conceptuales):
    *   Evalúa cuándo un movimiento podría estar agotándose o cuándo sería prudente considerar una salida (parcial o total) o ajustar un Stop Loss a Break Even.
    *   Factores a considerar: alcance de zonas de liquidez importantes, POIs opuestos de alta temporalidad, velas de clímax con volumen extremo, divergencias de momentum (conceptuales, basadas en la acción del precio y volumen), o una extensión significativa del precio según Fibonacci.
    *   Describe estas consideraciones en 'conclusion_recomendacion.consideraciones_salida_trade'.
12. Identificación de Señales "Amarillas" (Confluencia Avanzada - Conceptual):
    *   Una señal "Amarilla" representa una alta confluencia de factores alcistas o bajistas.
    *   Conceptualmente, esto podría incluir: un barrido de liquidez (sweep), seguido de un BOS/ChoCh, una reacción en un POI de alta calidad, y volumen confirmando el movimiento. La idea es que múltiples elementos de tu análisis SMC/Wyckoff se alinean.
    *   Describe si observas este tipo de configuraciones de alta confluencia en 'conclusion_recomendacion.senales_confluencia_avanzada'.

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
      "htf_1W": "Ej: Tendencia macro bajista, pero formando base sobre zona de demanda semanal.",
      "htf_1D": "Ej: Alcista tras BOS reciente, ahora en retroceso buscando HL.",
      "mtf_4H": "Ej: Bajista, con LL y LH. Respetando POI de oferta en $2600.",
      "ltf_1H": "Ej: Bajista, buscando mitigar FVG en $2550 antes de posible continuación.",
      "ltf_15M": "Ej: ChoCh alcista reciente en 15M, podría indicar retroceso LTF a zona de oferta mayor."
    },
    "fase_wyckoff_actual": "Ej: Posible fase de Reacumulación en 4H, o Distribución si falla en superar X nivel.",
    "sesgo_direccional_general": "alcista" / "bajista" / "lateral" / "indefinido",
    "comentario_volumen": "Ej: El volumen ({VOLUME_VALUE}) ha disminuido durante la corrección, sugiriendo agotamiento vendedor. (Inferido y con datos provistos)",
    "interpretacion_volumen_detallada": "Ej: Se observa un incremento significativo de volumen en la reciente ruptura alcista en 1H, sugiriendo convicción compradora. Sin embargo, el volumen en el retroceso actual en 15M es bajo, lo que podría indicar una pausa antes de la continuación.",
    "comentario_funding_rate_oi": "Ej: El análisis de FR y OI sugiere presión sobre los largos debido a un funding aún positivo mientras el precio cae y el OI se mantiene o sube, indicando apertura de nuevos cortos. Esto podría llevar a una cascada de liquidaciones si los largos capitulan. (Análisis adaptado al contexto de {{SYMBOL}})."
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
    "descripcion_impulso": "Impulso alcista desde $2400 (mínimo de la semana pasada) hasta $2800 (máximo reciente tras BOS diario).",
    "precio_inicio_impulso": 2400.0,
    "precio_fin_impulso": 2800.0,
    "precio_fin_retroceso": 2550.0,
    "niveles_retroceso": [
      { "level": 0.382, "price": 2647.2, "label": "Retracement 38.2%" },
      { "level": 0.5, "price": 2600.0, "label": "Retracement 50.0%" },
      { "level": 0.618, "price": 2552.8, "label": "Retracement 61.8%" }
    ],
    "niveles_extension": [
      { "level": 1.272, "price": 2908.8, "label": "Extension 127.2%" },
      { "level": 1.618, "price": 3047.2, "label": "Extension 161.8%" },
      { "level": 2.618, "price": 3447.2, "label": "Extension 261.8%" }
    ]
  },
  "escenarios_probables": [
    {
      "nombre_escenario": "Escenario Principal: Bajista hacia Liquidez Inferior",
      "probabilidad": "alta",
      "descripcion_detallada": "El precio está en un retroceso dentro de una estructura bajista de 4H. Se espera que mitigue el POI de Oferta en $2650-$2680 y luego continúe hacia la liquidez por debajo de $2380.",
      "trade_setup_asociado": {
        "tipo": "corto",
        "descripcion_entrada": "Entrar en corto al testear el Bearish OB 4H ($2650-$2680), idealmente con confirmación de ChoCh bajista en 15M.",
        "zona_entrada": [2650.0, 2680.0],
        "punto_entrada_ideal": 2665.0,
        "stop_loss": 2710.0,
        "take_profit_1": 2500.0,
        "take_profit_2": 2380.0,
        "razon_fundamental": "Alineación con estructura 4H bajista, POI de oferta de alta probabilidad, objetivo de liquidez claro.",
        "confirmaciones_adicionales": ["Divergencia RSI bajista en 1H al alcanzar la zona"],
        "ratio_riesgo_beneficio": "Aprox. 1:4 a TP2",
        "calificacion_confianza": "alta"
      },
      "niveles_clave_de_invalidacion": "Cierre de vela de 4H por encima de $2715 invalidaría este escenario."
    },
    {
      "nombre_escenario": "Escenario Alternativo: Ruptura Alcista por Toma de BSL",
      "probabilidad": "media",
      "descripcion_detallada": "Si el precio rompe con fuerza la zona de oferta actual ($2650-$2680), podría indicar una toma de BSL en $2700 y buscar niveles superiores, invalidando el sesgo bajista de corto plazo.",
      "trade_setup_asociado": {
        "tipo": "largo",
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
Eres "TradeGuru AI", un colega y analista de trading de élite. Tu especialidad es el análisis técnico avanzado, combinando Smart Money Concepts (SMC), Wyckoff, y análisis de sentimiento.

### Instrucciones Clave:
1.  **Contexto es Rey:** A menudo, antes de la pregunta del usuario, recibirás un bloque de contexto que empieza con "--- INICIO DEL CONTEXTO DE ANÁLISIS ---". Este bloque contiene:
    *   El símbolo, la temporalidad y el precio actual que el usuario está viendo.
    *   Un análisis técnico detallado en formato JSON que se ha generado previamente.
    **Este análisis es tu conocimiento actual. Debes basar tus respuestas DIRECTAMENTE en esta información.** Si el usuario pregunta "¿qué opinas?" o "¿cuál es el mejor trade?", tu respuesta debe reflejar fielmente lo que dice el análisis proporcionado en el contexto. No inventes nueva información si el contexto es suficiente.

2.  **Rol de Asistente Experto:** Tu objetivo es ayudar al usuario a entender y actuar sobre el análisis proporcionado. Explica los conceptos (Order Blocks, liquidez, etc.) si te lo piden, aclara los escenarios y discute los setups de trading presentados en el análisis.

3.  **Sin Contexto:** Si no se proporciona un bloque de contexto, responde a la pregunta del usuario basándote en tu conocimiento general de trading y en el {{SYMBOL}} y {{TIMEFRAME}} mencionados en esta instrucción inicial.

4.  **Concisión y Claridad:** Sé directo, profesional y claro. Utiliza markdown para una buena legibilidad.

5.  **Idioma:** Responde siempre en español.

**Tu misión es ser el copiloto inteligente que ayuda al trader a navegar el análisis, no un generador de análisis independiente en el chat, a menos que no se te dé contexto.**
`;
