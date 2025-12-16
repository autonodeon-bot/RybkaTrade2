import { Candle, Timeframe, OrderBookState } from '../types';

const BASE_URL = 'https://api.gateio.ws/api/v4';
const BINANCE_API = 'https://api.binance.com/api/v3';

// Detect environment
const isServer = typeof window === 'undefined';

const mapTimeframe = (tf: Timeframe) => tf; 

const getHeaders = () => {
    return {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
    };
};

// --- Connection Check ---
export const checkConnection = async (): Promise<boolean> => {
    try {
        // FIX: Do not hit Binance/Gate directly from client (CORS/451 errors).
        // Ping our own Netlify function. If it returns 200, the backend is reachable
        // and (presumably) the backend can talk to the exchange.
        const res = await fetch('/.netlify/functions/orderbook?pair=BTC_USDT');
        return res.ok;
    } catch (e) {
        console.error("Connection check failed:", e);
        return false;
    }
};

// Helper: Fetch from Binance (High Availability Fallback)
const fetchBinanceHistory = async (pair: string, timeframe: Timeframe): Promise<Candle[]> => {
    const symbol = pair.replace('_', ''); 
    const intervalMap: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h' };
    
    const url = `${BINANCE_API}/klines?symbol=${symbol}&interval=${intervalMap[timeframe]}&limit=100`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error('Binance API failed');
    
    const data = await res.json();
    
    return data.map((d: any[]) => ({
        time: d[0],
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5])
    })).sort((a: Candle, b: Candle) => a.time - b.time);
};

export const fetchHistory = async (pair: string, timeframe: Timeframe = '5m'): Promise<Candle[]> => {
  // IMPORTANT: This function should primarily be called server-side (in cron.ts).
  // If called client-side, it might fail due to CORS unless proxied.
  
  // 1. Try Gate.io 
  try {
      const gateInterval = mapTimeframe(timeframe);
      const targetUrl = `${BASE_URL}/spot/candlesticks?currency_pair=${pair}&interval=${gateInterval}&limit=100`;
      
      const response = await fetch(targetUrl, { headers: getHeaders() });

      if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
               return data.map((d: string[]) => ({
                  time: parseFloat(d[0]) * 1000,
                  volume: parseFloat(d[1]),
                  close: parseFloat(d[2]),
                  high: parseFloat(d[3]),
                  low: parseFloat(d[4]),
                  open: parseFloat(d[5])
              })).sort((a: Candle, b: Candle) => a.time - b.time);
          }
      }
  } catch (error) {
     if (isServer) console.warn("Gate API failed, switching to fallback...");
  }

  // 2. Fallback: Binance
  try {
      const binanceData = await fetchBinanceHistory(pair, timeframe);
      if (binanceData.length > 0) return binanceData;
  } catch (binanceError) {
      if (isServer) console.warn("Binance Fallback failed", binanceError);
  }

  throw new Error(`Failed to fetch real data for ${pair} from all sources.`);
};

export const fetchCurrentTicker = async (pair: string): Promise<{ last: number, volume: number } | null> => {
  try {
    const targetUrl = `${BASE_URL}/spot/tickers?currency_pair=${pair}`;
    const response = await fetch(targetUrl, { headers: getHeaders() });
    if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            return {
                last: parseFloat(data[0].last),
                volume: parseFloat(data[0].base_volume)
            };
        }
    }
  } catch (e) {}

  try {
      const symbol = pair.replace('_', '');
      const res = await fetch(`${BINANCE_API}/ticker/24hr?symbol=${symbol}`);
      if (res.ok) {
          const data = await res.json();
          return {
              last: parseFloat(data.lastPrice),
              volume: parseFloat(data.volume)
          };
      }
  } catch (e) {}

  return null;
};

export const fetchOrderBook = async (pair: string): Promise<OrderBookState | undefined> => {
  if (isServer) {
      // Server-side: Fetch directly from Gate.io (No CORS issues)
      const targetUrl = `${BASE_URL}/spot/order_book?currency_pair=${pair}&limit=10`; 
      try {
         const response = await fetch(targetUrl, { headers: getHeaders() });
         if(!response.ok) return undefined;
         
         const data = await response.json();
         if(data.bids && data.asks) {
             return {
                 bids: data.bids.map((b: string[]) => ({ price: parseFloat(b[0]), amount: parseFloat(b[1]), total: 0 })),
                 asks: data.asks.map((a: string[]) => ({ price: parseFloat(a[0]), amount: parseFloat(a[1]), total: 0 })).reverse()
             }
         }
      } catch(e) { return undefined; }
  } else {
      // Client-side: Proxy through our own Netlify function to avoid CORS
      try {
          const response = await fetch(`/.netlify/functions/orderbook?pair=${pair}`);
          if (!response.ok) return undefined;
          const data = await response.json();
          
          if(data.bids && data.asks) {
             return {
                 bids: data.bids.map((b: string[]) => ({ price: parseFloat(b[0]), amount: parseFloat(b[1]), total: 0 })),
                 asks: data.asks.map((a: string[]) => ({ price: parseFloat(a[0]), amount: parseFloat(a[1]), total: 0 })).reverse()
             }
          }
      } catch (e) { return undefined; }
  }
  return undefined;
};