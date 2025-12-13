import { Handler } from '@netlify/functions';
import { db } from '../../services/storage';

export const handler: Handler = async (event, context) => {
    const state = await db.get();
    
    return {
        statusCode: 200,
        headers: { 
            "Content-Type": "application/json"
        },
        body: JSON.stringify(state)
    };
};