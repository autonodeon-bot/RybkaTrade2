import { Candle, Timeframe, OrderBookState } from '../types';

const BASE_URL = 'https://api.gateio.ws/api/v4';
// Using AllOrigins as it handles JSON responses better than corsproxy.io often
const PROXY_URL = 'https://api.allorigins.win/get?url=';
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

export const generateMockCandles = (pair: string, count: number, startPrice?: number): Candle[] => {
  const now = Date.now();
  const candles: Candle[] = [];
  let price = startPrice || (pair.includes('BTC') ? 67000 : pair.includes('ETH') ? 3600 : pair.includes('SOL') ? 150 : 10);
  
  for (let i = count - 1; i >= 0; i--) {
    const time = now - i * 60000 * 5; 
    const volatility = 0.003;
    const change = price * volatility * (Math.random() - 0.5);
    const close = price + change;
    const high = Math.max(price, close) * (1 + Math.random() * 0.002);
    const low = Math.min(price, close) * (1 - Math.random() * 0.002);
    
    candles.push({
      time,
      open: price,
      close,
      high,
      low,
      volume: Math.floor(Math.random() * 1000 + 500)
    });
    price = close;
  }
  return candles;
};

// --- Connection Check ---
export const checkConnection = async (): Promise<boolean> => {
    try {
        // Try simple fetch to Binance as it's most reliable for a connectivity check
        const res = await fetch(`${BINANCE_API}/ticker/price?symbol=BTCUSDT`);
        return res.ok;
    } catch (e) {
        return false;
    }
};

// Helper: Fetch from Binance (High Availability Fallback)
const fetchBinanceHistory = async (pair: string, timeframe: Timeframe): Promise<Candle[]> => {
    // Map Gate pair (BTC_USDT) to Binance (BTCUSDT)
    const symbol = pair.replace('_', ''); 
    const intervalMap: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h' };
    
    const url = `${BINANCE_API}/klines?symbol=${symbol}&interval=${intervalMap[timeframe]}&limit=100`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error('Binance API failed');
    
    const data = await res.json();
    
    // Binance Format: [Open Time, Open, High, Low, Close, Volume, ...]
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
  // 1. Try Gate.io (Via Proxy if Client, Direct if Server)
  try {
      const gateInterval = mapTimeframe(timeframe);
      const targetUrl = `${BASE_URL}/spot/candlesticks?currency_pair=${pair}&interval=${gateInterval}&limit=100`;
      
      const fetchUrl = isServer ? targetUrl : `${PROXY_URL}${encodeURIComponent(targetUrl)}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const response = await fetch(fetchUrl, { 
          headers: getHeaders(),
          signal: controller.signal 
      });
      clearTimeout(timeoutId);

      if (response.ok) {
          const rawData = await response.json();
          // Handle 'allorigins' proxy wrapper
          let data = rawData;
          if (rawData.contents) {
              try {
                data = JSON.parse(rawData.contents);
              } catch (e) {
                  // Sometimes contents is not JSON if error page returned
                  throw new Error("Proxy returned invalid content");
              }
          }

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
     console.warn("Gate API failed, switching to fallback...");
  }

  // 2. High-Availability Fallback: Binance API (Direct, often CORS friendly or handles via simple proxy)
  try {
      const binanceData = await fetchBinanceHistory(pair, timeframe);
      if (binanceData.length > 0) return binanceData;
  } catch (binanceError) {
      console.warn("Binance Fallback failed", binanceError);
  }

  // 3. Last Resort: Mock Data
  console.warn(`All APIs failed for ${pair}, using mock data`);
  return generateMockCandles(pair, 100);
};

export const fetchCurrentTicker = async (pair: string): Promise<{ last: number, volume: number } | null> => {
  // Try Gate
  try {
    const targetUrl = `${BASE_URL}/spot/tickers?currency_pair=${pair}`;
    const fetchUrl = isServer ? targetUrl : `${PROXY_URL}${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(fetchUrl, { headers: getHeaders() });
    if (response.ok) {
        const raw = await response.json();
        let data = raw;
        if (raw.contents) {
             data = JSON.parse(raw.contents);
        }

        if (Array.isArray(data) && data.length > 0) {
            return {
                last: parseFloat(data[0].last),
                volume: parseFloat(data[0].base_volume)
            };
        }
    }
  } catch (e) {}

  // Fallback to Binance Ticker
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
  const targetUrl = `${BASE_URL}/spot/order_book?currency_pair=${pair}&limit=10`; 
  const fetchUrl = isServer ? targetUrl : `${PROXY_URL}${encodeURIComponent(targetUrl)}`;

  try {
     const response = await fetch(fetchUrl, { headers: getHeaders() });
     if(!response.ok) return undefined;
     
     const raw = await response.json();
     let data = raw;
     if (raw.contents) {
         data = JSON.parse(raw.contents);
     }
     
     if(data.bids && data.asks) {
         return {
             bids: data.bids.map((b: string[]) => ({ price: parseFloat(b[0]), amount: parseFloat(b[1]), total: 0 })),
             asks: data.asks.map((a: string[]) => ({ price: parseFloat(a[0]), amount: parseFloat(a[1]), total: 0 })).reverse()
         }
     }
  } catch(e) {
      // console.warn("Orderbook fetch failed");
  }
  return undefined;
};