
export enum PositionType {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h';

export interface Portfolio {
  balance: number;      // Cash available
  equity: number;       // Balance + Unrealized PnL
  usedMargin: number;   // Locked in trades
  totalProfit: number;  // Historical PnL
  dayStartBalance: number;
  winRate?: number;     // % winning trades
  profitFactor?: number; // Gross Profit / Gross Loss
  tradesCount?: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number; // cumulative
}

export interface OrderBookState {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export interface IndicatorValues {
  // Existing
  rsi: number;
  macd: { macd: number; signal: number; histogram: number };
  bollinger: { upper: number; middle: number; lower: number };
  emaShort: number;
  emaLong: number;
  stoch: { k: number; d: number };
  atr: number;
  obv: number;
  cci: number;
  williamsR: number;
  momentum: number;
  adx: number;
  smaVolume: number;
  
  // New 10 Indicators
  ichimoku: { tenkan: number; kijun: number };
  vwap: number;
  superTrend: { direction: 1 | -1; value: number }; // 1 = Up, -1 = Down
  psar: number; // Parabolic SAR
  keltner: { upper: number; lower: number };
  donchian: { upper: number; lower: number };
  mfi: number; // Money Flow Index
  ao: number; // Awesome Oscillator
  cmf: number; // Chaikin Money Flow
  roc: number; // Rate of Change
}

export interface Trade {
  id: string;
  pair: string;
  type: PositionType;
  entryPrice: number;
  amount: number;      // Position size in USDT
  quantity: number;    // Amount / EntryPrice
  stopLoss: number;
  takeProfit: number;
  openTime: number;
  closePrice?: number;
  closeTime?: number;
  pnl?: number;        // Percentage
  pnlValue?: number;   // USDT Value
  status: 'OPEN' | 'CLOSED';
  reason: string;
  trailingActive: boolean; // Is trailing stop activated?
  strategyUsed?: string; // e.g., 'Conservative', 'Aggressive'
}

export interface PersonaVerdict {
  decision: number; // -1 to 1
  reason: string;
}

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  trend: 'UP' | 'DOWN' | 'FLAT';
  rsi: number;
  personas: {
    conservative: PersonaVerdict;
    aggressive: PersonaVerdict;
    trend: PersonaVerdict;
  };
}

export interface AIAnalysisResult {
  pair: string;
  decision: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-100
  recommendedSL: number;
  recommendedTP: number;
  riskRewardRatio: number;
  reasoning: string;
  details: TimeframeAnalysis[];
  dominantPersona?: string; // Which strategy won
  externalSentiment?: number; // -1 to 1 (Added)
}

export interface MarketState {
  pair: string;
  price: number;
  candles: Candle[];
  timeframe: Timeframe;
  indicators: IndicatorValues | null;
  lastUpdated: number;
  orderBook?: OrderBookState; 
}

// --- LEARNING TYPES ---
export interface PersonaWeights {
    conservative: number;
    aggressive: number;
    trend: number;
}

export interface LearningState {
    weights: PersonaWeights;
    epoch: number;
    learningRate: number;
    lastCorrection: number; // Timestamp
}

// --- EXTERNAL SIGNALS ---
export type SignalProviderID = 'COINGECKO' | 'GROQ' | 'HUGGINGFACE' | 'SWISSBORG' | 'INCITE_AI' | 'PUMP_PARADE';

export interface ExternalProviderConfig {
    id: SignalProviderID;
    name: string;
    enabled: boolean;
    apiKey?: string; 
    apiSecret?: string; // Added for password/secret
    requiresSecret?: boolean; // UI flag
    url?: string;
    description: string;
}

export interface ExternalSignalResult {
    providerId: SignalProviderID;
    name: string;
    sentiment: number; // -1 (Strong Sell) to 1 (Strong Buy)
    confidence: number; // 0 to 100
    lastUpdated: number;
    details?: string;
    status: 'OK' | 'ERROR' | 'PENDING' | 'DISABLED' | 'AUTH_FAILED';
    latencyMs?: number;
}
