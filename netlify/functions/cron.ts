import { Handler } from '@netlify/functions';
import { fetchHistory, fetchCurrentTicker } from '../../services/gateApi';
import { performDeepAnalysis } from '../../services/localAi';
import { calculateAllIndicators } from '../../utils/indicators';

// This function now acts as the "Brain" of the system.
// It is stateless. It receives a request for a pair, analyzes it, and returns the verdict.
export const handler: Handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { pair } = body;

        if (!pair) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: 'Pair parameter is required' }) 
            };
        }

        // 1. Fetch Real-time Data (Server-side fetch to avoid CORS or hide keys if needed)
        const ticker = await fetchCurrentTicker(pair);
        const candles = await fetchHistory(pair, '5m');

        if (!ticker || candles.length === 0) {
             return { 
                statusCode: 500, 
                headers, 
                body: JSON.stringify({ error: `Failed to fetch data for ${pair}` }) 
            };
        }

        const currentPrice = ticker.last;

        // 2. Calculate Indicators
        const indicators = calculateAllIndicators(candles);
        
        // 3. Perform AI Analysis
        const analysis = await performDeepAnalysis(pair, currentPrice);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                pair,
                price: currentPrice,
                analysis,
                indicators, // Send back computed indicators for UI
                timestamp: Date.now()
            })
        };

    } catch (e: any) {
        console.error("Analysis Error:", e);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: e.message || 'Internal Server Error' }) 
        };
    }
};