
import { GoogleGenAI, Type } from "@google/genai";
import { IndicatorValues, AIAnalysisResult } from "../types";

const API_KEY = process.env.API_KEY || ''; 

let genAI: GoogleGenAI | null = null;

export const initGemini = (key: string) => {
  genAI = new GoogleGenAI({ apiKey: key });
};

if (process.env.API_KEY) {
  initGemini(process.env.API_KEY);
}

export const analyzeMarketWithAI = async (
  pair: string,
  price: number,
  indicators: IndicatorValues
): Promise<AIAnalysisResult> => {
  if (!genAI && process.env.API_KEY) {
      initGemini(process.env.API_KEY);
  }

  if (!genAI) {
     return {
        pair,
        decision: 'HOLD',
        confidence: 0,
        recommendedSL: 0,
        recommendedTP: 0,
        riskRewardRatio: 0,
        reasoning: "API Key not initialized",
        details: []
     };
  }

  const prompt = `
    Ты - элитная система алгоритмической торговли. 
    Проанализируй рыночные данные для пары ${pair} (Текущая цена: ${price}).
    
    ОСНОВНЫЕ ИНДИКАТОРЫ:
    1. RSI: ${indicators.rsi.toFixed(2)}
    2. MACD Hist: ${indicators.macd.histogram.toFixed(4)}
    3. Bollinger: ${indicators.bollinger.upper.toFixed(2)} / ${indicators.bollinger.lower.toFixed(2)}
    4. EMA: Short ${indicators.emaShort.toFixed(2)} / Long ${indicators.emaLong.toFixed(2)}
    5. ADX: ${indicators.adx.toFixed(2)}
    
    НОВЫЕ ИНДИКАТОРЫ (ВАЖНО):
    6. SuperTrend: ${indicators.superTrend.direction === 1 ? 'BULLISH' : 'BEARISH'} (Level: ${indicators.superTrend.value})
    7. VWAP: ${indicators.vwap.toFixed(2)} (Price is ${price > indicators.vwap ? 'ABOVE' : 'BELOW'} VWAP)
    8. Ichimoku: Tenkan ${indicators.ichimoku.tenkan.toFixed(2)} vs Kijun ${indicators.ichimoku.kijun.toFixed(2)}
    9. MFI (Money Flow): ${indicators.mfi.toFixed(2)}
    10. ROC (Rate of Change): ${indicators.roc.toFixed(2)}%
    11. Awesome Oscillator: ${indicators.ao.toFixed(4)}
    12. Chaikin Money Flow: ${indicators.cmf.toFixed(4)}
    
    ЗАДАЧА:
    Проанализируй рынок, используя комбинацию старых и новых индикаторов (особенно SuperTrend и VWAP).
    Прими торговое решение (BUY, SELL, или HOLD).
    Рассчитай уровни Stop Loss и Take Profit.
    Оцени уверенность (0-100).
  `;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decision: { type: Type.STRING, enum: ["BUY", "SELL", "HOLD"] },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
            recommendedSL: { type: Type.NUMBER },
            recommendedTP: { type: Type.NUMBER },
            riskRewardRatio: { type: Type.NUMBER },
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    const result = JSON.parse(text);

    return {
      pair,
      decision: result.decision,
      confidence: result.confidence,
      recommendedSL: result.recommendedSL,
      recommendedTP: result.recommendedTP,
      riskRewardRatio: result.riskRewardRatio || 0,
      reasoning: result.reasoning,
      details: []
    };

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    return {
      pair,
      decision: 'HOLD',
      confidence: 0,
      recommendedSL: 0,
      recommendedTP: 0,
      riskRewardRatio: 0,
      reasoning: "Ошибка соединения с нейросетью.",
      details: []
    };
  }
};
