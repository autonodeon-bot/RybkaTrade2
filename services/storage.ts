import { Portfolio, Trade, MarketState, AIAnalysisResult } from "../types";

// In a real Vercel production app, you MUST use Vercel KV (Redis) or Postgres.
// Global variables in Serverless functions are reset when the container spins down (cold start).
// This MockStorage uses a global variable which might persist for a few minutes while the function is "warm".
// For 24/7 autonomy, replace this with @vercel/kv.

interface SystemState {
    portfolio: Portfolio;
    trades: Trade[];
    marketData: Record<string, MarketState>;
    lastAnalysis: Record<string, AIAnalysisResult>;
    logs: {msg: string, type: 'info'|'success'|'error'|'warn', time: number}[];
    lastUpdated: number;
}

// Initial State
let GLOBAL_STATE: SystemState = {
    portfolio: {
        balance: 10000,
        equity: 10000,
        usedMargin: 0,
        totalProfit: 0,
        dayStartBalance: 10000
    },
    trades: [],
    marketData: {},
    lastAnalysis: {},
    logs: [],
    lastUpdated: Date.now()
};

export const db = {
    get: async (): Promise<SystemState> => {
        // Simulation of DB fetch
        return GLOBAL_STATE;
    },
    
    update: async (partial: Partial<SystemState>) => {
        GLOBAL_STATE = { ...GLOBAL_STATE, ...partial, lastUpdated: Date.now() };
        // In real app: await kv.set('trading_state', GLOBAL_STATE);
        return GLOBAL_STATE;
    },

    addLog: async (msg: string, type: 'info'|'success'|'error'|'warn' = 'info') => {
        const newLog = { msg, type, time: Date.now() };
        const logs = [newLog, ...GLOBAL_STATE.logs].slice(0, 50); // Keep last 50
        GLOBAL_STATE.logs = logs;
    }
};