import { Handler } from '@netlify/functions';

const BASE_URL = 'https://api.gateio.ws/api/v4';

export const handler: Handler = async (event) => {
    const pair = event.queryStringParameters?.pair || 'BTC_USDT';
    
    try {
        const response = await fetch(`${BASE_URL}/spot/order_book?currency_pair=${pair}&limit=10`, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            return { statusCode: response.status, body: 'Error fetching from Gate' };
        }

        const data = await response.json();
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        };
    } catch (e: any) {
        return { statusCode: 500, body: e.message };
    }
};