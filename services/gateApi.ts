import { Candle, Timeframe, OrderBookState } from '../types';

const BASE_URL = 'https://api.gateio.ws/api/v4';
const PROXY_URL = 'https://api.allorigins.win/raw?url=';

// Detect environment
const isServer = typeof window === 'undefined';

const mapTimeframe = (tf: Timeframe) => tf; 

const generateMockCandles = (pair: string, count: number, startPrice?: number): Candle[] => {
  const now = Date.now();
  const candles: Candle[] = [];
  let price = startPrice || (pair.includes('BTC') ? 67000 : pair.includes('ETH') ? 3600 : 150);
  
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
      volume: Math.floor(Math.random() * 1000)
    });
    price = close;
  }
  return candles;
};

export const fetchHistory = async (pair: string, timeframe: Timeframe = '5m'): Promise<Candle[]> => {
  const gateInterval = mapTimeframe(timeframe);
  const targetUrl = `${BASE_URL}/spot/candlesticks?currency_pair=${pair}&interval=${gateInterval}&limit=100`;
  
  // Use Proxy only in browser to avoid CORS. Server can hit Gate.io directly.
  const fetchUrl = isServer ? targetUrl : `${PROXY_URL}${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(fetchUrl);
    
    // Gate.io might return 400/429 if rate limited
    if (!response.ok) throw new Error(`Gate API Error: ${response.statusText}`);
    
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Invalid Data');

    return data.map((d: string[]) => ({
      time: parseFloat(d[0]) * 1000,
      volume: parseFloat(d[1]),
      close: parseFloat(d[2]),
      high: parseFloat(d[3]),
      low: parseFloat(d[4]),
      open: parseFloat(d[5])
    })).sort((a: Candle, b: Candle) => a.time - b.time);

  } catch (error) {
    console.warn(`Fetch Error for ${pair}:`, error);
    // Return mock data so the app doesn't crash
    return generateMockCandles(pair, 100);
  }
};

export const fetchCurrentTicker = async (pair: string): Promise<{ last: number, volume: number } | null> => {
  const targetUrl = `${BASE_URL}/spot/tickers?currency_pair=${pair}`;
  const fetchUrl = isServer ? targetUrl : `${PROXY_URL}${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        last: parseFloat(data[0].last),
        volume: parseFloat(data[0].base_volume)
      };
    }
  } catch (error) {
    return null;
  }
  return null;
};

export const fetchOrderBook = async (pair: string): Promise<OrderBookState | undefined> => {
  // Limit 10 for performance in demo
  const targetUrl = `${BASE_URL}/spot/order_book?currency_pair=${pair}&limit=10`; 
  const fetchUrl = isServer ? targetUrl : `${PROXY_URL}${encodeURIComponent(targetUrl)}`;

  try {
     const response = await fetch(fetchUrl);
     if(!response.ok) return undefined;
     const data = await response.json();
     
     if(data.bids && data.asks) {
         return {
             bids: data.bids.map((b: string[]) => ({ price: parseFloat(b[0]), amount: parseFloat(b[1]), total: 0 })),
             asks: data.asks.map((a: string[]) => ({ price: parseFloat(a[0]), amount: parseFloat(a[1]), total: 0 })).reverse()
         }
     }
  } catch(e) {
      console.warn("Orderbook fetch failed");
  }
  return undefined;
};
