
import { Candle, IndicatorValues } from '../types';

// Helper: Calculate Simple Moving Average
const calculateSMA = (data: number[], period: number): number => {
  if (data.length < period) return 0;
  const slice = data.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
};

// Helper: Calculate Exponential Moving Average
const calculateEMA = (data: number[], period: number, prevEMA?: number): number => {
  if (data.length < period) return 0;
  const k = 2 / (period + 1);
  const price = data[data.length - 1];
  
  if (prevEMA === undefined) {
    return calculateSMA(data, period);
  }
  return price * k + prevEMA * (1 - k);
};

// --- EXISTING INDICATORS ---

export const calculateRSI = (candles: Candle[], period: number = 14): number => {
  if (candles.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

export const calculateMACD = (closes: number[]) => {
  const shortPeriod = 12;
  const longPeriod = 26;
  const emaShort = calculateEMA(closes, shortPeriod, calculateSMA(closes.slice(0, -1), shortPeriod));
  const emaLong = calculateEMA(closes, longPeriod, calculateSMA(closes.slice(0, -1), longPeriod));
  const macdLine = emaShort - emaLong;
  const signalLine = macdLine * 0.8; 
  return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine };
};

export const calculateBollinger = (closes: number[], period: number = 20, multiplier: number = 2) => {
  const sma = calculateSMA(closes, period);
  const slice = closes.slice(-period);
  const squaredDiffs = slice.map(val => Math.pow(val - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(variance);
  return { upper: sma + (stdDev * multiplier), middle: sma, lower: sma - (stdDev * multiplier) };
};

export const calculateStoch = (candles: Candle[], period: number = 14) => {
  if (candles.length < period) return { k: 50, d: 50 };
  const slice = candles.slice(-period);
  const lowMin = Math.min(...slice.map(c => c.low));
  const highMax = Math.max(...slice.map(c => c.high));
  const currentClose = candles[candles.length - 1].close;
  const k = ((currentClose - lowMin) / (highMax - lowMin)) * 100;
  return { k, d: k };
};

export const calculateATR = (candles: Candle[], period: number = 14): number => {
  if (candles.length < period + 1) return 0;
  const c = candles[candles.length - 1];
  const p = candles[candles.length - 2];
  const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  return tr; 
};

export const calculateOBV = (candles: Candle[]): number => {
  let obv = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) obv += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume;
  }
  return obv;
};

export const calculateCCI = (candles: Candle[], period: number = 20): number => {
  if (candles.length < period) return 0;
  const tps = candles.slice(-period).map(c => (c.high + c.low + c.close) / 3);
  const smaTP = tps.reduce((a, b) => a + b, 0) / period;
  const meanDev = tps.reduce((a, b) => a + Math.abs(b - smaTP), 0) / period;
  const currentTP = tps[tps.length - 1];
  return (currentTP - smaTP) / (0.015 * meanDev);
};

export const calculateWilliamsR = (candles: Candle[], period: number = 14): number => {
  if (candles.length < period) return -50;
  const slice = candles.slice(-period);
  const highMax = Math.max(...slice.map(c => c.high));
  const lowMin = Math.min(...slice.map(c => c.low));
  const currentClose = candles[candles.length - 1].close;
  return ((highMax - currentClose) / (highMax - lowMin)) * -100;
};

export const calculateMomentum = (closes: number[], period: number = 10): number => {
  if (closes.length < period + 1) return 0;
  return closes[closes.length - 1] - closes[closes.length - 1 - period];
};

export const calculateADX = (candles: Candle[], period: number = 14): number => {
  if (candles.length < period + 1) return 25;
  const atr = calculateATR(candles, period);
  const closes = candles.map(c => c.close);
  const emaShort = calculateEMA(closes, 9);
  const emaLong = calculateEMA(closes, 21);
  const divergence = Math.abs(emaShort - emaLong) / emaLong * 1000;
  return Math.min(100, Math.max(0, 20 + divergence * 2));
};

export const calculateVolumeSMA = (candles: Candle[], period: number = 20): number => {
  const volumes = candles.map(c => c.volume);
  return calculateSMA(volumes, period);
};

// --- NEW INDICATORS ---

// 1. Ichimoku Cloud (Simplified: Tenkan & Kijun only)
export const calculateIchimoku = (candles: Candle[]) => {
  const getAvg = (period: number) => {
    if (candles.length < period) return 0;
    const slice = candles.slice(-period);
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    return (high + low) / 2;
  };
  return {
    tenkan: getAvg(9),
    kijun: getAvg(26)
  };
};

// 2. VWAP (Rolling 20 period for demo)
export const calculateVWAP = (candles: Candle[], period: number = 20): number => {
  if (candles.length < period) return candles[candles.length-1].close;
  const slice = candles.slice(-period);
  let cumTPVol = 0;
  let cumVol = 0;
  slice.forEach(c => {
    const tp = (c.high + c.low + c.close) / 3;
    cumTPVol += tp * c.volume;
    cumVol += c.volume;
  });
  return cumVol ? cumTPVol / cumVol : candles[candles.length-1].close;
};

// 3. SuperTrend
export const calculateSuperTrend = (candles: Candle[], period = 10, multiplier = 3): { direction: 1 | -1, value: number } => {
  if (candles.length < period) return { direction: 1, value: 0 };
  // Approximate implementation for last candle
  const atr = calculateATR(candles, period);
  const last = candles[candles.length-1];
  const hl2 = (last.high + last.low) / 2;
  const basicUpper = hl2 + (multiplier * atr);
  const basicLower = hl2 - (multiplier * atr);
  const close = last.close;
  
  // Simple heuristic for direction without full recursion of history
  const prevClose = candles[candles.length-2].close;
  const isUp = close > prevClose; 
  
  return {
    direction: isUp ? 1 : -1,
    value: isUp ? basicLower : basicUpper
  };
};

// 4. Parabolic SAR (Simplified)
export const calculatePSAR = (candles: Candle[]): number => {
  if (candles.length < 5) return 0;
  // Simplified calculation based on last few candles trend
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const trend = last.close > prev.close ? 1 : -1;
  const acceleration = 0.02;
  
  if (trend === 1) return last.low * (1 - acceleration);
  return last.high * (1 + acceleration);
};

// 5. Keltner Channels
export const calculateKeltner = (candles: Candle[], period = 20, multiplier = 2) => {
  if (candles.length < period) return { upper: 0, lower: 0 };
  const closes = candles.map(c => c.close);
  const ema = calculateEMA(closes, period);
  const atr = calculateATR(candles, 10); // Often uses 10 ATR
  return {
    upper: ema + (multiplier * atr),
    lower: ema - (multiplier * atr)
  };
};

// 6. Donchian Channels
export const calculateDonchian = (candles: Candle[], period = 20) => {
  if (candles.length < period) return { upper: 0, lower: 0 };
  const slice = candles.slice(-period);
  return {
    upper: Math.max(...slice.map(c => c.high)),
    lower: Math.min(...slice.map(c => c.low))
  };
};

// 7. Money Flow Index (MFI)
export const calculateMFI = (candles: Candle[], period = 14): number => {
  if (candles.length < period + 1) return 50;
  const slice = candles.slice(-(period + 1));
  let posMF = 0;
  let negMF = 0;
  
  for(let i=1; i<slice.length; i++) {
    const cur = slice[i];
    const prev = slice[i-1];
    const tp = (cur.high + cur.low + cur.close) / 3;
    const prevTp = (prev.high + prev.low + prev.close) / 3;
    const rawMF = tp * cur.volume;
    
    if (tp > prevTp) posMF += rawMF;
    else if (tp < prevTp) negMF += rawMF;
  }
  
  if (negMF === 0) return 100;
  const mfr = posMF / negMF;
  return 100 - (100 / (1 + mfr));
};

// 8. Awesome Oscillator (AO)
export const calculateAO = (candles: Candle[]): number => {
  if (candles.length < 35) return 0;
  const mps = candles.map(c => (c.high + c.low) / 2);
  const sma5 = calculateSMA(mps, 5);
  const sma34 = calculateSMA(mps, 34);
  return sma5 - sma34;
};

// 9. Chaikin Money Flow (CMF)
export const calculateCMF = (candles: Candle[], period = 20): number => {
  if (candles.length < period) return 0;
  const slice = candles.slice(-period);
  let adSum = 0;
  let volSum = 0;
  
  slice.forEach(c => {
    const mfv = ((c.close - c.low) - (c.high - c.close)) / (c.high - c.low || 1);
    const ad = mfv * c.volume;
    adSum += ad;
    volSum += c.volume;
  });
  
  return volSum ? adSum / volSum : 0;
};

// 10. Rate of Change (ROC)
export const calculateROC = (closes: number[], period = 9): number => {
  if (closes.length < period + 1) return 0;
  const current = closes[closes.length - 1];
  const past = closes[closes.length - 1 - period];
  return ((current - past) / past) * 100;
};


export const calculateAllIndicators = (candles: Candle[]): IndicatorValues => {
  const closes = candles.map(c => c.close);
  
  return {
    // Existing
    rsi: calculateRSI(candles),
    macd: calculateMACD(closes),
    bollinger: calculateBollinger(closes),
    emaShort: calculateEMA(closes, 9),
    emaLong: calculateEMA(closes, 21),
    stoch: calculateStoch(candles),
    atr: calculateATR(candles),
    obv: calculateOBV(candles),
    cci: calculateCCI(candles),
    williamsR: calculateWilliamsR(candles),
    momentum: calculateMomentum(closes),
    adx: calculateADX(candles),
    smaVolume: calculateVolumeSMA(candles),
    
    // New
    ichimoku: calculateIchimoku(candles),
    vwap: calculateVWAP(candles),
    superTrend: calculateSuperTrend(candles),
    psar: calculatePSAR(candles),
    keltner: calculateKeltner(candles),
    donchian: calculateDonchian(candles),
    mfi: calculateMFI(candles),
    ao: calculateAO(candles),
    cmf: calculateCMF(candles),
    roc: calculateROC(closes)
  };
};
