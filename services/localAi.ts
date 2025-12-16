
import * as tf from '@tensorflow/tfjs';
import { IndicatorValues, AIAnalysisResult, Timeframe, Candle, TimeframeAnalysis, PersonaWeights } from "../types";
import { calculateAllIndicators } from '../utils/indicators';
import { fetchHistory } from './gateApi';

interface PersonaDefinition {
  name: string;
  weights: number[]; 
  bias: number;
}

// Updated Weights for more inputs (now 20 inputs)
const PERSONAS: Record<string, PersonaDefinition> = {
  conservative: {
    name: "Conservative",
    // Prioritize: RSI, Bollinger, SuperTrend, Keltner, VWAP
    weights: [
      -0.8, 0.2, -0.6, 0.2, -0.4, -0.2, 0.1, -0.2, -0.3, 0.1, 0.3, -0.1, // Old 12
       0.1, 0.5, 0.8, -0.2, -0.4, 0.1, 0.1, 0.2, 0.2, 0.1 // New 8
    ], 
    bias: 0.3
  },
  aggressive: {
    name: "Aggressive",
    // Prioritize: Momentum, ROC, AO, CCI, Donchian Breakouts
    weights: [
      -0.2, 0.6, 0.1, 0.4, 0.3, 0.5, 0.3, 0.6, 0.2, 0.9, 0.2, 0.4, // Old 12
       0.2, 0.1, 0.2, 0.1, 0.1, 0.8, 0.3, 0.9, 0.4, 1.2 // New 8 (High on ROC/AO)
    ],
    bias: -0.2
  },
  trend: {
    name: "Trend",
    // Prioritize: ADX, EMA, SuperTrend, Ichimoku, PSAR
    weights: [
      0.1, 0.8, 0.2, 1.2, 0.1, 0.1, 0.4, 0.2, 0.1, 0.3, 1.5, 0.5, // Old 12 (High ADX)
      0.9, 0.2, 1.5, 0.7, 0.3, 0.4, 0.2, 0.3, 0.2, 0.5 // New 8 (High SuperTrend/Ichimoku)
    ], 
    bias: 0.1
  }
};

const normalizeInput = (ind: IndicatorValues): number[] => {
  return [
    // Original 12
    (ind.rsi - 50) / 50,
    ind.macd.histogram * 10,
    (ind.bollinger.upper - ind.bollinger.lower) === 0 ? 0 : (ind.rsi / 100),
    (ind.emaShort - ind.emaLong),
    (ind.stoch.k - 50) / 50,
    ind.atr * 10,
    ind.obv > 0 ? 0.5 : -0.5,
    ind.cci / 100,
    (ind.williamsR + 50) / 50,
    ind.momentum,
    (ind.adx - 25) / 25,
    ind.smaVolume > 0 ? 1 : 0,

    // New 8 (Selecting key metrics from the new 10 for the Tensor input)
    (ind.ichimoku.tenkan - ind.ichimoku.kijun), // Ichimoku Cross
    (ind.vwap > 0 ? 1 : 0), // Placeholder for VWAP proximity logic could be better
    ind.superTrend.direction, // 1 or -1
    (ind.psar > 0 ? 1 : -1), // Simply presence? No, improved below
    (ind.keltner.upper - ind.keltner.lower),
    (ind.donchian.upper - ind.donchian.lower),
    (ind.mfi - 50) / 50,
    ind.ao,
    ind.cmf,
    ind.roc / 10 
  ];
};

const analyzeTimeframe = (tfName: Timeframe, candles: Candle[]): TimeframeAnalysis => {
  const indicators = calculateAllIndicators(candles);
  // Ensure we pick first 20 valid inputs or pad logic
  const inputData = normalizeInput(indicators).slice(0, 22); // Expanded input vector
  
  return tf.tidy(() => {
    const inputTensor = tf.tensor1d(inputData);
    const personasResult: any = {};

    Object.entries(PERSONAS).forEach(([key, persona]) => {
      // Safety check for weight length
      const weights = persona.weights.slice(0, inputData.length);
      const weightsTensor = tf.tensor1d(weights);
      const score = inputTensor.dot(weightsTensor).add(tf.scalar(persona.bias)).dataSync()[0];
      const activation = Math.tanh(score);

      let reason = "";
      if (activation > 0.35) reason = "BUY";
      else if (activation < -0.35) reason = "SELL";
      else reason = "WAIT";

      personasResult[key] = { decision: activation, reason };
    });

    const trend = indicators.superTrend.direction === 1 ? 'UP' : 'DOWN';

    return {
      timeframe: tfName,
      trend,
      rsi: indicators.rsi,
      personas: personasResult
    };
  });
};

export const performDeepAnalysis = async (
    pair: string, 
    currentPrice: number,
    dynamicWeights?: PersonaWeights,
    externalSentiment: number = 0 // New Parameter: Input from External AI Aggregator (-1 to 1)
): Promise<AIAnalysisResult> => {
  const [candles5m, candles15m, candles1h] = await Promise.all([
    fetchHistory(pair, '5m'),
    fetchHistory(pair, '15m'),
    fetchHistory(pair, '1h')
  ]);

  if (candles5m.length < 50) throw new Error("Not enough data");

  const analysis5m = analyzeTimeframe('5m', candles5m);
  const analysis15m = analyzeTimeframe('15m', candles15m);
  const analysis1h = analyzeTimeframe('1h', candles1h);

  const ind1h = calculateAllIndicators(candles1h);
  
  // Advanced Filtering Logic
  const isTrendStrong = ind1h.adx > 20;
  const isSuperTrendBullish = ind1h.superTrend.direction === 1;
  const isVwapBullish = currentPrice > ind1h.vwap;

  // Use Dynamic Weights or Default to balanced 1/1/1
  const w = dynamicWeights || { conservative: 1, aggressive: 1, trend: 1 };
  
  // Normalize weights roughly
  const totalW = w.conservative + w.aggressive + w.trend;
  const nW = { 
      cons: w.conservative / totalW, 
      aggr: w.aggressive / totalW, 
      trnd: w.trend / totalW 
  };

  const calculateAggregateScore = (key: 'conservative' | 'aggressive' | 'trend') => {
    return (
      (analysis5m.personas[key].decision * 0.2) + 
      (analysis15m.personas[key].decision * 0.3) + 
      (analysis1h.personas[key].decision * 0.5)
    );
  };

  const scoreTrend = calculateAggregateScore('trend');
  const scoreConservative = calculateAggregateScore('conservative');
  const scoreAggressive = calculateAggregateScore('aggressive');

  // Weighted Average based on Learning + External Sentiment Impact
  // External sentiment can sway the score by up to 20%
  let totalScore = (
      (scoreConservative * nW.cons) + 
      (scoreAggressive * nW.aggr) + 
      (scoreTrend * nW.trnd)
  );
  
  // Mix in External AI Sentiment
  if (externalSentiment !== 0) {
      totalScore = (totalScore * 0.8) + (externalSentiment * 0.2);
  }

  let decision: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let confidence = Math.abs(totalScore) * 100;
  let dominantPersona = 'Balanced';
  
  if (Math.abs(scoreTrend) > Math.abs(scoreConservative) && Math.abs(scoreTrend) > Math.abs(scoreAggressive)) dominantPersona = 'Trend Follower';
  if (Math.abs(scoreConservative) > Math.abs(scoreTrend) && Math.abs(scoreConservative) > Math.abs(scoreAggressive)) dominantPersona = 'Conservative';
  if (Math.abs(scoreAggressive) > Math.abs(scoreTrend) && Math.abs(scoreAggressive) > Math.abs(scoreConservative)) dominantPersona = 'Aggressive';

  // Logic Refinement with New Indicators
  if (totalScore > 0.35) {
      if (isSuperTrendBullish && isVwapBullish) {
          decision = 'BUY';
          confidence += 10; 
      } else if (isTrendStrong && isSuperTrendBullish) {
          decision = 'BUY';
      }
  } else if (totalScore < -0.35) {
      if (!isSuperTrendBullish && !isVwapBullish) {
          decision = 'SELL';
          confidence += 10;
      } else if (isTrendStrong && !isSuperTrendBullish) {
          decision = 'SELL';
      }
  }

  if (decision === 'BUY' && currentPrice < ind1h.ichimoku.tenkan) {
      confidence -= 15;
  }

  const atr = ind1h.atr || (currentPrice * 0.01);
  let sl = 0, tp = 0;
  const rewardRatio = 2.0;

  if (decision === 'BUY') {
    sl = ind1h.superTrend.direction === 1 ? ind1h.superTrend.value : currentPrice - (atr * 2);
    tp = currentPrice + ((currentPrice - sl) * rewardRatio);
  } else if (decision === 'SELL') {
    sl = ind1h.superTrend.direction === -1 ? ind1h.superTrend.value : currentPrice + (atr * 2);
    tp = currentPrice - ((sl - currentPrice) * rewardRatio);
  }

  confidence = Math.min(99, Math.max(0, confidence));

  let reasoning = `Strategy: ${dominantPersona}. `;
  if (externalSentiment !== 0) reasoning += `Ext Sentiment: ${externalSentiment > 0 ? '+' : ''}${externalSentiment.toFixed(2)}. `;
  reasoning += `Trend 1H: ${analysis1h.trend}. `;
  
  if (decision !== 'HOLD') {
      reasoning += `${decision} Signal. Conf: ${confidence.toFixed(0)}%.`;
  } else {
      reasoning += "Waiting for higher confluence.";
  }

  return {
    pair,
    decision,
    confidence: Math.round(confidence),
    recommendedSL: sl,
    recommendedTP: tp,
    riskRewardRatio: rewardRatio,
    reasoning,
    details: [analysis5m, analysis15m, analysis1h],
    dominantPersona,
    externalSentiment
  };
};
