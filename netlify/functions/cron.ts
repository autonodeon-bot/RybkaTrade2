import { Handler, schedule } from '@netlify/functions';
import { db } from '../../services/storage';
import { fetchHistory, fetchCurrentTicker } from '../../services/gateApi';
import { performDeepAnalysis } from '../../services/localAi';
import { calculateAllIndicators } from '../../utils/indicators';
import { PositionType, Trade } from '../../types';

const PAIRS = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'TON_USDT', 'DOGE_USDT'];
const COMMISSION_RATE = 0.001; // 0.1%

// Основная логика торгового цикла
const tradingLogic = async () => {
    // 1. Load State
    const state = await db.get();
    const { portfolio, trades } = state;
    
    let updatedPortfolio = { ...portfolio };
    let updatedTrades = [...trades];
    let updatedAnalysis = { ...state.lastAnalysis };
    let updatedMarketData = { ...state.marketData };

    // 2. Iterate Pairs
    for (const pair of PAIRS) {
        // Fetch Live Price
        const ticker = await fetchCurrentTicker(pair);
        if (!ticker) continue;
        const currentPrice = ticker.last;

        // Fetch History for Analysis (Server Side)
        const candles = await fetchHistory(pair, '5m');
        if (candles.length > 0) {
            const indicators = calculateAllIndicators(candles);
            
            // Update Market Snapshot
            updatedMarketData[pair] = {
                pair,
                price: currentPrice,
                candles: candles, // Store last 100 candles
                timeframe: '5m',
                indicators,
                lastUpdated: Date.now()
            };

            // 3. AI Analysis
            try {
                const analysis = await performDeepAnalysis(pair, currentPrice);
                updatedAnalysis[pair] = analysis;

                // 4. Execute New Trades
                const hasOpenPosition = updatedTrades.some(t => t.pair === pair && t.status === 'OPEN');
                
                // Calc Available Margin (Equity - Used)
                let unrealizedPnL = 0;
                updatedTrades.filter(t => t.status === 'OPEN').forEach(t => { unrealizedPnL += (t.pnlValue || 0); });
                const currentEquity = updatedPortfolio.balance + unrealizedPnL;
                const freeMargin = currentEquity - updatedPortfolio.usedMargin;

                if (!hasOpenPosition && analysis.decision !== 'HOLD' && analysis.confidence > 75) {
                    const riskAmount = currentEquity * 0.02; // Risk 2% of equity
                    const distToSL = Math.abs(currentPrice - analysis.recommendedSL);
                    
                    if (distToSL > 0) {
                        let positionSize = riskAmount / (distToSL / currentPrice);
                        positionSize = Math.min(positionSize, currentEquity * 0.25); // Cap max trade size at 25% equity

                        // Ensure min trade size ($10) and max trade size (Free Margin)
                        if (positionSize < 10) positionSize = 10;
                        
                        if (freeMargin >= positionSize) {
                            const type = analysis.decision === 'BUY' ? PositionType.LONG : PositionType.SHORT;
                            const newTrade: Trade = {
                                id: Math.random().toString(36).substr(2, 9),
                                pair,
                                type,
                                entryPrice: currentPrice,
                                amount: positionSize,
                                quantity: positionSize / currentPrice,
                                stopLoss: analysis.recommendedSL,
                                takeProfit: analysis.recommendedTP,
                                openTime: Date.now(),
                                status: 'OPEN',
                                reason: `Auto-Bot (${analysis.confidence}%)`,
                                trailingActive: false
                            };

                            updatedTrades.push(newTrade);
                            updatedPortfolio.balance -= (positionSize * COMMISSION_RATE); // Deduct opening commission immediately
                            updatedPortfolio.usedMargin += positionSize; // Lock margin
                            
                            await db.addLog(`AUTONOMOUS: Opened ${type} ${pair} Size: $${positionSize.toFixed(0)}`, 'success');
                        }
                    }
                }

            } catch (e) {
                console.error(`Analysis failed for ${pair}`, e);
            }
        }

        // 5. Manage Open Trades (SL/TP/Trailing)
        updatedTrades = updatedTrades.map(trade => {
            if (trade.status === 'CLOSED' || trade.pair !== pair) return trade;

            const priceDiff = trade.type === PositionType.LONG ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
            const pnlValue = (priceDiff * trade.quantity);
            const pnlPercent = (pnlValue / trade.amount) * 100;

            // Trailing Logic
            let newSL = trade.stopLoss;
            let trailingActive = trade.trailingActive;
            if (!trailingActive && pnlPercent > 1.5) trailingActive = true; // Activate trailing at 1.5% profit
            
            if (trailingActive) {
                const dist = currentPrice * 0.01; // 1% trailing distance
                if (trade.type === PositionType.LONG && (currentPrice - dist) > trade.stopLoss) {
                    newSL = currentPrice - dist;
                }
                if (trade.type === PositionType.SHORT && (currentPrice + dist) < trade.stopLoss) {
                    newSL = currentPrice + dist;
                }
            }

            // Check Exit
            let shouldClose = false;
            let reason = "";
            if (trade.type === PositionType.LONG) {
                if (currentPrice <= newSL) { shouldClose = true; reason = "SL Hit"; }
                if (currentPrice >= trade.takeProfit) { shouldClose = true; reason = "TP Hit"; }
            } else {
                if (currentPrice >= newSL) { shouldClose = true; reason = "SL Hit"; }
                if (currentPrice <= trade.takeProfit) { shouldClose = true; reason = "TP Hit"; }
            }

            if (shouldClose) {
                const closeCommission = trade.amount * COMMISSION_RATE;
                const finalPnL = pnlValue - closeCommission;
                
                updatedPortfolio.balance += finalPnL; // Realize PnL into Balance
                updatedPortfolio.usedMargin -= trade.amount; // Release margin
                updatedPortfolio.totalProfit += finalPnL;
                
                db.addLog(`AUTONOMOUS: Closed ${trade.pair} ${reason} ($${finalPnL.toFixed(2)})`, finalPnL > 0 ? 'success' : 'error');

                return { ...trade, stopLoss: newSL, trailingActive, status: 'CLOSED', closePrice: currentPrice, closeTime: Date.now(), pnl: pnlPercent, pnlValue: finalPnL, reason };
            }

            return { ...trade, stopLoss: newSL, trailingActive, pnl: pnlPercent, pnlValue };
        });
    }

    // 6. Recalculate Equity Final
    let totalUnrealizedPnL = 0;
    updatedTrades.filter(t => t.status === 'OPEN').forEach(t => {
         totalUnrealizedPnL += (t.pnlValue || 0);
    });
    updatedPortfolio.equity = updatedPortfolio.balance + totalUnrealizedPnL;

    // 7. Save State
    await db.update({
        portfolio: updatedPortfolio,
        trades: updatedTrades,
        marketData: updatedMarketData,
        lastAnalysis: updatedAnalysis
    });

    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, timestamp: Date.now(), equity: updatedPortfolio.equity })
    };
};

// Стандартный HTTP хендлер для ручного вызова или фронтенда
export const handler: Handler = async (event, context) => {
    return tradingLogic();
};

// Если на Netlify включены Scheduled Functions (для платных/новых аккаунтов), можно раскомментировать:
// export const handler = schedule("@hourly", tradingLogic);
