import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../services/storage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const state = await db.get();
    
    // Return the full state to the frontend
    return res.status(200).json(state);
}