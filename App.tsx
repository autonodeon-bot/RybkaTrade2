import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Wifi, WifiOff, BarChart3, LayoutDashboard, Eye, Activity, Globe, Cpu, PlayCircle, StopCircle, RefreshCw, Trash2 } from 'lucide-react';
import { MarketChart } from './components/Chart';
import { IndicatorCard } from './components/IndicatorCard';
import { TradeHistory } from './components/TradeHistory';
import { PortfolioCard } from './components/PortfolioCard';
import { OrderBook } from './components/OrderBook';
import { MarketState, Trade, AIAnalysisResult, Portfolio, Timeframe, OrderBookState, PositionType } from './types';
import { fetchOrderBook } from './services/gateApi';

const PAIRS = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'TON_USDT', 'DOGE_USDT'];
const INITIAL_PORTFOLIO: Portfolio = {
    balance: 10000,
    equity: 10000,
    usedMargin: 0,
    totalProfit: 0,
    dayStartBalance: 10000,
    winRate: 0,
    profitFactor: 0,
    tradesCount: 0
};

export default function App() {
  const [active, setActive] = useState(true);
  const [currentPair, setCurrentPair] = useState('BTC_USDT');
  const [viewMode, setViewMode] = useState<'CHART' | 'DASHBOARD'>('CHART');
  const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>('5m');
  const [serverStatus, setServerStatus] = useState<'IDLE' | 'ANALYZING' | 'ERROR'>('IDLE');
  const [orderBook, setOrderBook] = useState<OrderBookState | undefined>(undefined);

  // --- Client Side State (Persisted) ---
  const [portfolio, setPortfolio] = useState<Portfolio>(INITIAL_PORTFOLIO);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [marketData, setMarketData] = useState<Record<string, MarketState>>({});
  const [lastAnalysis, setLastAnalysis] = useState<Record<string, AIAnalysisResult>>({});
  const [logs, setLogs] = useState<{msg: string, type: string, time: number}[]>([]);

  // Load State on Mount
  useEffect(() => {
    const saved = localStorage.getItem('gateio_bot_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            setPortfolio(parsed.portfolio || INITIAL_PORTFOLIO);
            setTrades(parsed.trades || []);
            setLogs(parsed.logs || []);
        } catch (e) {
            console.error("Failed to load state", e);
        }
    }
  }, []);

  // Save State on Change
  useEffect(() => {
    const stateToSave = { portfolio, trades, logs: logs.slice(0, 50) };
    localStorage.setItem('gateio_bot_state', JSON.stringify(stateToSave));
  }, [portfolio, trades, logs]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
      setLogs(prev => [{ msg, type, time: Date.now() }, ...prev].slice(0, 50));
  };

  const clearState = () => {
      if(confirm("Reset all trading data?")) {
          setPortfolio(INITIAL_PORTFOLIO);
          setTrades([]);
          setLogs([]);
          setMarketData({});
          setLastAnalysis({});
          localStorage.removeItem('gateio_bot_state');
          window.location.reload();
      }
  };

  // --- Core Analysis Function ---
  const performAnalysis = async (pairToAnalyze: string) => {
    try {
        setServerStatus('ANALYZING');
        // Call Serverless Function for Heavy Analysis
        const res = await fetch('/api/cron', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pair: pairToAnalyze })
        });
        
        if (!res.ok) throw new Error("API Error");
        const data = await res.json();
        
        if (data.success) {
            const { price, analysis, indicators, candles } = data;
            
            // Update Market Data State
            setMarketData(prev => ({
                ...prev,
                [pairToAnalyze]: {
                    pair: pairToAnalyze,
                    price,
                    candles: candles || [], 
                    timeframe: '5m',
                    indicators,
                    lastUpdated: Date.now()
                }
            }));

            setLastAnalysis(prev => ({
                ...prev,
                [pairToAnalyze]: analysis
            }));

            // --- EXECUTE TRADING LOGIC (CLIENT SIDE) ---
            handleTradingLogic(pairToAnalyze, price, analysis);
            return true;
        }
    } catch (e) {
        console.error("Analysis Error:", e);
        setServerStatus('ERROR');
        return false;
    } finally {
        setServerStatus('IDLE');
    }
  };

  // --- Effect: Analyze Current Pair Immediately on Change ---
  useEffect(() => {
      performAnalysis(currentPair);
  }, [currentPair]);

  // --- Effect: Background Trading Loop ---
  useEffect(() => {
    if (!active) return;

    const runTradingCycle = async () => {
        // Randomly pick a pair to analyze for background trading opportunities
        const randomPair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
        
        // If the random pair is the current pair, we skip because the other useEffect handles it
        if (randomPair !== currentPair) {
            await performAnalysis(randomPair);
        }
    };

    const interval = setInterval(runTradingCycle, 4000); // Check other pairs every 4s
    return () => clearInterval(interval);
  }, [active, portfolio, trades, currentPair]); 

  const handleTradingLogic = (pair: string, currentPrice: number, analysis: AIAnalysisResult) => {
      // 1. Manage Open Trades (TP/SL)
      let updatedTrades = [...trades];
      let updatedPortfolio = { ...portfolio };
      let stateChanged = false;

      updatedTrades = updatedTrades.map(trade => {
          if (trade.status === 'CLOSED' || trade.pair !== pair) return trade;
          
          let closeReason = null;
          let pnlValue = 0;
          const isLong = trade.type === PositionType.LONG;

          // Check SL/TP
          if (isLong) {
              if (currentPrice >= trade.takeProfit) closeReason = 'TP Hit';
              else if (currentPrice <= trade.stopLoss) closeReason = 'SL Hit';
          } else {
              if (currentPrice <= trade.takeProfit) closeReason = 'TP Hit';
              else if (currentPrice >= trade.stopLoss) closeReason = 'SL Hit';
          }

          // Calculate PnL (Floating)
          const diff = isLong ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
          pnlValue = diff * trade.quantity;
          const pnlPercent = (pnlValue / trade.amount) * 100;

          if (closeReason) {
              stateChanged = true;
              const commission = trade.amount * 0.001;
              const finalPnL = pnlValue - commission;
              
              updatedPortfolio.balance += (trade.amount + finalPnL);
              updatedPortfolio.usedMargin -= trade.amount;
              updatedPortfolio.totalProfit += finalPnL;
              updatedPortfolio.tradesCount = (updatedPortfolio.tradesCount || 0) + 1;
              
              if (finalPnL > 0) updatedPortfolio.winRate = ((updatedPortfolio.winRate || 0) * (updatedPortfolio.tradesCount-1) + 100) / updatedPortfolio.tradesCount;
              else updatedPortfolio.winRate = ((updatedPortfolio.winRate || 0) * (updatedPortfolio.tradesCount-1)) / updatedPortfolio.tradesCount;

              addLog(`CLOSED ${pair}: ${closeReason} ($${finalPnL.toFixed(2)})`, finalPnL > 0 ? 'success' : 'error');
              
              return { 
                  ...trade, 
                  status: 'CLOSED', 
                  closePrice: currentPrice, 
                  closeTime: Date.now(), 
                  pnl: pnlPercent, 
                  pnlValue: finalPnL, 
                  reason: closeReason 
              } as Trade;
          }

          return { ...trade, pnl: pnlPercent, pnlValue } as Trade;
      });

      // 2. Open New Trades
      const hasPosition = updatedTrades.some(t => t.pair === pair && t.status === 'OPEN');
      if (!hasPosition && analysis.decision !== 'HOLD' && analysis.confidence > 75) {
          const riskAmount = updatedPortfolio.balance * 0.1; // Use 10% of balance
          if (updatedPortfolio.balance > riskAmount && riskAmount > 10) {
              stateChanged = true;
              const type = analysis.decision === 'BUY' ? PositionType.LONG : PositionType.SHORT;
              const quantity = riskAmount / currentPrice;
              
              const newTrade: Trade = {
                  id: Date.now().toString(),
                  pair,
                  type,
                  entryPrice: currentPrice,
                  amount: riskAmount,
                  quantity,
                  stopLoss: analysis.recommendedSL,
                  takeProfit: analysis.recommendedTP,
                  openTime: Date.now(),
                  status: 'OPEN',
                  reason: `AI (${analysis.confidence}%)`,
                  trailingActive: false,
                  pnl: 0,
                  pnlValue: 0
              };

              updatedTrades.push(newTrade);
              updatedPortfolio.balance -= riskAmount;
              updatedPortfolio.usedMargin += riskAmount;
              
              addLog(`OPEN ${type} ${pair} @ ${currentPrice.toFixed(2)}`, 'info');
          }
      }

      // Recalculate Equity
      let floatingPnL = 0;
      updatedTrades.filter(t => t.status === 'OPEN').forEach(t => floatingPnL += (t.pnlValue || 0));
      updatedPortfolio.equity = updatedPortfolio.balance + updatedPortfolio.usedMargin + floatingPnL;

      if (stateChanged) {
          setTrades(updatedTrades);
          setPortfolio(updatedPortfolio);
      }
  };

  // Polling Loop for Order Book
  useEffect(() => {
     const fetchOB = async () => {
         const ob = await fetchOrderBook(currentPair);
         if(ob) setOrderBook(ob);
     };
     fetchOB();
     const interval = setInterval(fetchOB, 3000); 
     return () => clearInterval(interval);
  }, [currentPair]);

  const currentData = marketData[currentPair] || { price: 0, candles: [], indicators: null };
  const currentAnalysis = lastAnalysis[currentPair];
  const activeTrade = trades.find(t => t.pair === currentPair && t.status === 'OPEN');

  const containerStyle = { color: 'white', minHeight: '100vh', backgroundColor: '#0f172a' };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-2 md:p-4 pb-20" style={containerStyle}>
      <header className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 bg-gray-800/50 p-3 rounded-xl border border-gray-700 backdrop-blur-md sticky top-0 z-50 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg shadow-lg relative">
            <Globe className={`text-white h-5 w-5 ${serverStatus === 'ANALYZING' ? 'animate-spin' : ''}`} />
            {serverStatus !== 'ERROR' && <span className="absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ring-gray-900 bg-green-400" />}
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Gate.io Autonomous <span className="text-[10px] bg-yellow-500 text-black px-1 rounded font-bold">DEMO</span>
            </h1>
            <div className="flex items-center gap-3">
               <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/30">
                 NETLIFY
               </span>
               <span className="text-[10px] text-gray-500 font-mono">
                   AI-BOT: {active ? 'RUNNING' : 'PAUSED'}
               </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
            <button onClick={() => setActive(!active)} className={`flex items-center gap-1 px-3 py-1.5 rounded border transition-all text-xs font-bold ${active ? 'bg-amber-600/20 text-amber-400 border-amber-600/50' : 'bg-green-600/20 text-green-400 border-green-600/50'}`}>
                {active ? <StopCircle size={14}/> : <PlayCircle size={14}/>} {active ? 'PAUSE BOT' : 'START BOT'}
            </button>
            <button onClick={clearState} title="Reset Portfolio" className="p-2 rounded bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/50">
                <Trash2 size={16} />
            </button>

            <div className="bg-gray-900 rounded-lg p-1 flex border border-gray-700 ml-2">
                <button onClick={() => setViewMode('CHART')} className={`p-2 rounded transition-all ${viewMode === 'CHART' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                    <BarChart3 size={18} />
                </button>
                <button onClick={() => setViewMode('DASHBOARD')} className={`p-2 rounded transition-all ${viewMode === 'DASHBOARD' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                    <LayoutDashboard size={18} />
                </button>
            </div>
        </div>
      </header>

      {/* PORTFOLIO WIDGET */}
      <PortfolioCard portfolio={portfolio} />

      {viewMode === 'CHART' ? (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Market View (9 cols) */}
        <div className="lg:col-span-9 space-y-4">
          <div className="flex justify-between items-center bg-gray-800 p-2 rounded-lg border border-gray-700">
             <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                {PAIRS.map(pair => (
                <button key={pair} onClick={() => setCurrentPair(pair)} className={`whitespace-nowrap px-3 py-1.5 rounded text-xs font-bold transition-colors ${currentPair === pair ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-900 text-gray-400 hover:bg-gray-700'}`}>
                    {pair.split('_')[0]}
                    {lastAnalysis[pair]?.decision === 'BUY' && <span className="ml-1 text-emerald-400">•</span>}
                </button>
                ))}
             </div>
             <div className="flex gap-1 bg-gray-900 p-1 rounded shrink-0">
                 {['1m','5m','15m','1h'].map(tf => (
                     <button key={tf} onClick={() => setCurrentTimeframe(tf as Timeframe)} className={`px-3 py-1 rounded text-xs transition-colors ${currentTimeframe === tf ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                         {tf}
                     </button>
                 ))}
             </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 h-[500px]">
            {/* Main Chart */}
            <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-xl flex flex-col relative">
                <div className="flex justify-between items-end mb-2 border-b border-gray-700 pb-2">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tighter flex items-center gap-3">
                        ${currentData.price ? currentData.price.toFixed(currentData.price < 10 ? 4 : 2) : '---'}
                    </h2>
                </div>
                <div className="text-right flex items-center gap-4">
                     {/* Sentiment Gauge */}
                     <div className="flex flex-col items-center">
                        <div className="text-[10px] text-gray-500 uppercase">Sentiment</div>
                        <div className={`text-sm font-bold ${currentAnalysis?.decision === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {currentAnalysis?.decision || 'NEUTRAL'}
                        </div>
                     </div>
                </div>
                </div>
                
                <MarketChart 
                    data={currentData.candles} 
                    indicators={currentData.indicators} 
                    currentPrice={currentData.price} 
                    activeTrade={activeTrade}
                    suggestedLevels={currentAnalysis?.decision !== 'HOLD' ? {sl: currentAnalysis?.recommendedSL || 0, tp: currentAnalysis?.recommendedTP || 0} : undefined}
                />
            </div>

            {/* Order Book Panel (Desktop) */}
            <div className="hidden lg:block w-64 bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-xl flex flex-col">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Activity size={12} /> Order Book
                </h3>
                <div className="flex-1 bg-gray-900/50 rounded border border-gray-700/50 overflow-hidden">
                    <OrderBook data={orderBook} />
                </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-xl">
             {currentData.indicators ? <IndicatorCard indicators={currentData.indicators} /> : <div className="text-center text-gray-500 text-sm py-4">Waiting for Analysis Update...</div>}
          </div>
        </div>

        {/* Right: Analysis & Logs (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-lg">
             <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                 <Cpu className="text-indigo-400" size={16} /> Neural Engine
             </h3>
             {currentAnalysis ? (
                 <div className="space-y-3">
                     <div className="p-3 bg-gray-900/50 rounded border border-gray-700 text-xs text-gray-300 leading-relaxed font-mono">
                         {currentAnalysis.reasoning}
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                         <div className="bg-rose-900/20 p-2 rounded border border-rose-900/30">
                             <div className="text-[10px] text-rose-400 uppercase font-bold">Stop Loss</div>
                             <div className="text-white font-mono text-sm">${currentAnalysis.recommendedSL.toFixed(2)}</div>
                         </div>
                         <div className="bg-emerald-900/20 p-2 rounded border border-emerald-900/30">
                             <div className="text-[10px] text-emerald-400 uppercase font-bold">Take Profit</div>
                             <div className="text-white font-mono text-sm">${currentAnalysis.recommendedTP.toFixed(2)}</div>
                         </div>
                     </div>
                     <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-700">
                         <span>Confidence</span>
                         <span className="text-white font-bold">{currentAnalysis.confidence}%</span>
                     </div>
                 </div>
             ) : (
                 <div className="text-center py-8 text-gray-500 text-xs border-2 border-dashed border-gray-700 rounded-lg">
                     Waiting for AI...
                 </div>
             )}
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-xl h-[300px] flex flex-col">
             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Settings size={14} /> Active Positions</h3>
             <div className="flex-1 overflow-y-auto -mx-2 px-2">
                 <TradeHistory trades={trades} />
             </div>
          </div>

          <div className="bg-black/30 border border-gray-800 rounded-xl p-3 h-[200px] overflow-hidden flex flex-col font-mono text-[10px]">
            <h4 className="text-gray-500 uppercase mb-2 tracking-wider font-bold">Terminal Logs</h4>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
               {logs.map((log, i) => (
                 <div key={i} className={`truncate ${log.type === 'error' ? 'text-rose-400' : log.type === 'success' ? 'text-emerald-400' : log.type === 'warn' ? 'text-yellow-400' : 'text-gray-500'}`}>
                   <span className="opacity-40 mr-1">[{new Date(log.time).toLocaleTimeString().split(' ')[0]}]</span>
                   {log.msg}
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
      ) : (
        /* ADMIN DASHBOARD VIEW */
        <div className="space-y-6">
           <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                    <h3 className="font-bold text-white flex items-center gap-2"><Eye size={16}/> Global Market Matrix</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                            <tr>
                                <th className="p-4">Pair</th>
                                <th className="p-4">Conf</th>
                                <th className="p-4">Action</th>
                                <th className="p-4">Last Updated</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {PAIRS.map(pair => {
                                const analysis = lastAnalysis[pair];
                                return (
                                <tr key={pair} className="hover:bg-gray-700/30">
                                    <td className="p-4 font-bold font-mono text-white">{pair.split('_')[0]}</td>
                                    <td className="p-4">{analysis ? `${analysis.confidence}%` : '-'}</td>
                                    <td className="p-4">
                                        {analysis && <span className={`px-2 py-1 rounded text-xs font-bold ${analysis.decision === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : analysis.decision === 'SELL' ? 'bg-rose-500/20 text-rose-400' : 'bg-gray-600/20 text-gray-400'}`}>
                                            {analysis.decision}
                                        </span>}
                                    </td>
                                    <td className="p-4 text-xs text-gray-500">
                                        {marketData[pair]?.lastUpdated ? new Date(marketData[pair].lastUpdated).toLocaleTimeString() : '-'}
                                    </td>
                                </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}