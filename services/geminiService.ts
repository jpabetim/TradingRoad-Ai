
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GeminiAnalysisResult, GeminiRequestPayload } from "../types";
import { GEMINI_MODEL_NAME, getFullAnalysisPrompt } from "../constants";

// Función para obtener la API key desde las variables de entorno
export const getGeminiApiKey = (): string => {
  // Orden de prioridad: 1. import.meta.env (desarrollo Vite), 2. process.env (build de producción)
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.API_KEY);

  console.log('🔍 Debug API Key detection:', {
    viteEnv: import.meta.env?.VITE_GEMINI_API_KEY ? 'Found' : 'Not found',
    processGemini: (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ? 'Found' : 'Not found',
    processAPI: (typeof process !== 'undefined' && process.env?.API_KEY) ? 'Found' : 'Not found',
    finalKey: apiKey ? `Found (${apiKey.substring(0, 10)}...)` : 'Not found',
    env: typeof import.meta !== 'undefined' ? 'Vite' : 'Node'
  });

  if (!apiKey || apiKey === "TU_CLAVE_API_DE_GEMINI_AQUI" || apiKey === "your_gemini_api_key_here") {
    console.error("Gemini API Key (VITE_GEMINI_API_KEY) is not set or is the placeholder value. AI analysis will be disabled.");
    throw new Error("Gemini API Key is not configured. Please set VITE_GEMINI_API_KEY in your environment variables.");
  }

  return apiKey;
};

// Función auxiliar para intentar reparar JSON incompleto - versión simple
function attemptJSONRepair(jsonString: string): string {
  let repaired = jsonString.trim();

  // Si termina con una coma, quitar la coma
  if (repaired.endsWith(',')) {
    repaired = repaired.slice(0, -1);
  }

  // Contar llaves y corchetes para detectar si el JSON está incompleto
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  // Si faltan llaves de cierre, intentar cerrarlas
  const missingBraces = openBraces - closeBraces;
  const missingBrackets = openBrackets - closeBrackets;

  // Cerrar arrays incompletos primero
  for (let i = 0; i < missingBrackets; i++) {
    repaired += ']';
  }

  // Cerrar objetos incompletos
  for (let i = 0; i < missingBraces; i++) {
    repaired += '}';
  }

  return repaired;
}

// Función para crear un análisis de fallback
function createFallbackAnalysis(symbol: string, timeframe: string): GeminiAnalysisResult {
  return {
    analisis_general: {
      simbolo: symbol,
      temporalidad_principal_analisis: timeframe,
      fecha_analisis: new Date().toISOString(),
      estructura_mercado_resumen: {
        ltf_1H: "Análisis no disponible debido a error de parsing"
      },
      sesgo_direccional_general: "indefinido",
      interpretacion_volumen_detallada: "No se pudo procesar el análisis de volumen debido a un error técnico."
    },
    puntos_clave_grafico: [],
    liquidez_importante: {
      buy_side: [],
      sell_side: []
    },
    zonas_criticas_oferta_demanda: {
      oferta_clave: [],
      demanda_clave: [],
      fvg_importantes: []
    },
    escenarios_probables: [{
      nombre_escenario: "Análisis de Fallback",
      descripcion_detallada: "No se pudo completar el análisis debido a un error técnico. Por favor, intenta de nuevo.",
      probabilidad: "baja",
      trade_setup_asociado: {
        tipo: "ninguno",
        descripcion_entrada: "No disponible",
        punto_entrada_ideal: undefined,
        stop_loss: 0,
        take_profit_1: 0,
        ratio_riesgo_beneficio: undefined,
        calificacion_confianza: "baja",
        razon_fundamental: "Error técnico"
      }
    }],
    conclusion_recomendacion: {
      resumen_ejecutivo: "El análisis no pudo completarse debido a un error técnico. Recomendamos intentar el análisis nuevamente.",
      proximo_movimiento_esperado: "Indeterminado",
      mejor_oportunidad_actual: {
        tipo: "ninguno",
        descripcion_entrada: "No disponible",
        punto_entrada_ideal: undefined,
        stop_loss: 0,
        take_profit_1: 0,
        ratio_riesgo_beneficio: undefined,
        calificacion_confianza: "baja",
        razon_fundamental: "Error técnico"
      }
    }
  };
}

// getApiKey function is removed as apiKey will be passed directly.

export interface ExtendedGeminiRequestPayload extends GeminiRequestPayload {
  latestVolume?: number | null;
  apiKey: string; // API key is now part of the payload
}

export const analyzeChartWithGemini = async (
  payload: ExtendedGeminiRequestPayload
): Promise<GeminiAnalysisResult> => {
  const { apiKey, ...restOfPayload } = payload; // Extract apiKey from payload

  if (!apiKey || apiKey === "TU_CLAVE_API_DE_GEMINI_AQUI") {
    console.error("API_KEY is not configured or is a placeholder. It was passed to analyzeChartWithGemini.");
    throw new Error("API Key is not configured or is a placeholder. AI analysis disabled.");
  }

  const ai = new GoogleGenAI({ apiKey }); // Use the apiKey from payload

  const fullPrompt = getFullAnalysisPrompt(
    restOfPayload.symbol,
    restOfPayload.timeframe,
    restOfPayload.currentPrice,
    restOfPayload.latestVolume
  );

  const finalPromptWithTimestamp = fullPrompt.replace("AUTO_GENERATED_TIMESTAMP_ISO8601", new Date().toISOString());

  let genAIResponse: GenerateContentResponse | undefined;

  try {
    genAIResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: finalPromptWithTimestamp,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192, // Restaurado al valor original
        temperature: 0.2, // Restaurado al valor original
      },
    });

    // Log the raw text response from Gemini for debugging
    console.log("Raw text response from Gemini API:", genAIResponse?.text);

    if (!genAIResponse?.text) {
      console.warn("No text response from Gemini API, returning fallback analysis");
      return createFallbackAnalysis(restOfPayload.symbol, restOfPayload.timeframe);
    }

    let jsonStr = genAIResponse.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    let parsedData: GeminiAnalysisResult;

    try {
      parsedData = JSON.parse(jsonStr) as GeminiAnalysisResult;
    } catch (parseError) {
      console.log('Initial JSON parsing failed, attempting repair...');
      console.log('Problematic JSON string from Gemini (leading to parsing error):', jsonStr);

      // Intentar reparar el JSON
      const repairedJSON = attemptJSONRepair(jsonStr);
      console.log('Attempting to parse repaired JSON...');

      try {
        parsedData = JSON.parse(repairedJSON) as GeminiAnalysisResult;
        console.log('Successfully parsed repaired JSON');
      } catch (repairError) {
        console.error('JSON repair also failed:', repairError);
        console.log('Returning fallback analysis due to JSON parsing errors');
        return createFallbackAnalysis(restOfPayload.symbol, restOfPayload.timeframe);
      }
    }

    if (!parsedData.analisis_general || !parsedData.escenarios_probables) {
      console.warn("Parsed Gemini response seems to be missing key fields.", parsedData);
      return createFallbackAnalysis(restOfPayload.symbol, restOfPayload.timeframe);
    }

    return parsedData;

  } catch (error: any) {
    console.error("Error calling Gemini API or parsing response. Full error object:", error);

    let errorMessage = "Failed to get analysis from Gemini. An unknown error occurred during the API call or response processing.";

    if (error.message) {
      if (error.message.includes("API_KEY_INVALID") || error.message.includes("API key not valid")) {
        errorMessage = "Gemini API Key is invalid. Please check your API_KEY configuration in index.html.";
      } else if (error.message.includes("quota") || error.message.includes("Quota")) {
        errorMessage = "Gemini API quota exceeded. Please check your quota or try again later.";
      } else if (error.message.toLowerCase().includes("json") || error instanceof SyntaxError) { // Catch SyntaxError explicitly
        console.log("JSON parsing error detected, returning fallback analysis");
        if (genAIResponse && typeof genAIResponse.text === 'string') {
          console.error("Problematic JSON string from Gemini (leading to parsing error):", genAIResponse.text);
        }
        return createFallbackAnalysis(restOfPayload.symbol, restOfPayload.timeframe);
      } else {
        errorMessage = `Gemini API error: ${error.message}`;
      }
    } else if (typeof error === 'string' && error.includes("```")) {
      errorMessage = "Received a malformed response from Gemini (likely unparsed markdown/JSON).";
      if (genAIResponse && typeof genAIResponse.text === 'string') { // Log it here too
        console.error("Malformed (markdown/JSON) string from Gemini:", genAIResponse.text);
      }
    } else if (error && typeof error.toString === 'function') {
      const errorString = error.toString();
      errorMessage = `Gemini API call failed: ${errorString.startsWith('[object Object]') ? 'Non-descriptive error object received.' : errorString}`;
    }

    // Include raw response text in error if available and not already logged by specific conditions
    if (genAIResponse && typeof genAIResponse.text === 'string' && !errorMessage.toLowerCase().includes("json")) {
      // Avoid re-logging if already handled by the SyntaxError/json message condition
      // but ensure it's logged if some other error occurred after receiving text.
      console.error("Gemini raw response text during error:", genAIResponse.text);
    }


    throw new Error(errorMessage);
  }
};
