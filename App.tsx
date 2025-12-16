
import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Wifi, WifiOff, BarChart3, LayoutDashboard, Eye, Activity, Globe, Cpu, PlayCircle, StopCircle, RefreshCw, Trash2, CheckCircle2, XCircle, Loader2, BrainCircuit, Zap, TrendingUp, TrendingDown, Layers, ChevronRight, Signal, Network } from 'lucide-react';
import { MarketChart } from './components/Chart';
import { IndicatorCard } from './components/IndicatorCard';
import { TradeHistory } from './components/TradeHistory';
import { PortfolioCard } from './components/PortfolioCard';
import { OrderBook } from './components/OrderBook';
import { SignalSettings } from './components/SignalSettings'; 
import { IntelligenceDashboard } from './components/IntelligenceDashboard'; // New Import
import { MarketState, Trade, AIAnalysisResult, Portfolio, Timeframe, OrderBookState, PositionType, LearningState, ExternalProviderConfig, ExternalSignalResult } from './types';
import { fetchOrderBook, checkConnection } from './services/gateApi';
import { DEFAULT_PROVIDERS, fetchAggregatedSignals } from './services/aggregator'; 

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

const INITIAL_LEARNING: LearningState = {
    weights: { conservative: 1, aggressive: 1, trend: 1 },
    epoch: 0,
    learningRate: 0.1,
    lastCorrection: Date.now()
};

export default function App() {
  const [active, setActive] = useState(true);
  const [currentPair, setCurrentPair] = useState('BTC_USDT');
  const [viewMode, setViewMode] = useState<'CHART' | 'DASHBOARD'>('CHART');
  const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>('5m');
  const [serverStatus, setServerStatus] = useState<'IDLE' | 'ANALYZING' | 'ERROR'>('IDLE');
  const [gateStatus, setGateStatus] = useState<'PENDING' | 'OK' | 'ERROR'>('PENDING');
  const [orderBook, setOrderBook] = useState<OrderBookState | undefined>(undefined);

  // --- Client Side State (Persisted) ---
  const [portfolio, setPortfolio] = useState<Portfolio>(INITIAL_PORTFOLIO);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [learningState, setLearningState] = useState<LearningState>(INITIAL_LEARNING);
  const [marketData, setMarketData] = useState<Record<string, MarketState>>({});
  const [lastAnalysis, setLastAnalysis] = useState<Record<string, AIAnalysisResult>>({});
  const [logs, setLogs] = useState<{msg: string, type: string, time: number}[]>([]);
  
  // External Signals State
  const [externalConfigs, setExternalConfigs] = useState<ExternalProviderConfig[]>(DEFAULT_PROVIDERS);
  const [externalSignals, setExternalSignals] = useState<ExternalSignalResult[]>([]);
  const [showSignalSettings, setShowSignalSettings] = useState(false);
  const [showIntelligenceDashboard, setShowIntelligenceDashboard] = useState(false); // New State

  // Load State on Mount
  useEffect(() => {
    const saved = localStorage.getItem('gateio_bot_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            setPortfolio(parsed.portfolio || INITIAL_PORTFOLIO);
            setTrades(parsed.trades || []);
            setLogs(parsed.logs || []);
            setLearningState(parsed.learningState || INITIAL_LEARNING);
            if(parsed.externalConfigs) setExternalConfigs(parsed.externalConfigs);
        } catch (e) {
            console.error("Failed to load state", e);
        }
    }

    // Check Gate.io Connection
    const testGate = async () => {
        const isOk = await checkConnection();
        setGateStatus(isOk ? 'OK' : 'ERROR');
        if (!isOk) addLog('Внимание: Проблема с подключением к API биржи.', 'error');
    };
    testGate();

  }, []);

  // Save State on Change
  useEffect(() => {
    const stateToSave = { portfolio, trades, logs: logs.slice(0, 50), learningState, externalConfigs };
    localStorage.setItem('gateio_bot_state', JSON.stringify(stateToSave));
  }, [portfolio, trades, logs, learningState, externalConfigs]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
      setLogs(prev => [{ msg, type, time: Date.now() }, ...prev].slice(0, 50));
  };

  const clearState = () => {
      if(confirm("Reset all trading data and brain memory?")) {
          setPortfolio(INITIAL_PORTFOLIO);
          setTrades([]);
          setLogs([]);
          setLearningState(INITIAL_LEARNING);
          setMarketData({});
          setLastAnalysis({});
          setExternalConfigs(DEFAULT_PROVIDERS);
          localStorage.removeItem('gateio_bot_state');
          window.location.reload();
      }
  };

  // --- Core Analysis Function ---
  const performAnalysis = async (pairToAnalyze: string) => {
    setServerStatus('ANALYZING');
    
    let sentimentOffset = 0;
    const currentMData = marketData[pairToAnalyze];
    
    if (currentMData) {
        const { results, globalSentiment } = await fetchAggregatedSignals(pairToAnalyze, currentMData, externalConfigs);
        setExternalSignals(results);
        sentimentOffset = globalSentiment;
    }

    try {
        let data;
        const payload = {
            pair: pairToAnalyze,
            weights: learningState.weights,
            externalSentiment: sentimentOffset
        };

        const res = await fetch('/.netlify/functions/cron', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            const json = await res.json();
            if (json.success) {
                data = json;
            } else {
                throw new Error(json.error || 'API returned failure');
            }
        } else {
            if (res.status === 404) {
                 throw new Error("API Endpoint not found (404). Backend is not deployed correctly.");
            }
            throw new Error(`Server API Error: ${res.status}`);
        }

        if (data && data.success) {
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

            // THIS CHECKS ORDERS AND EXECUTES TRADES
            handleTradingLogic(pairToAnalyze, price, analysis);
            
            setGateStatus('OK');
            return true;
        }

    } catch (e: any) {
        console.error("Critical Analysis Error:", e);
        setServerStatus('ERROR');
        const is404 = e.message.includes('404');
        addLog(`Ошибка данных ${pairToAnalyze}: ${is404 ? 'API 404 (Проверьте деплой)' : e.message}`, 'error');
        setGateStatus('ERROR');
        return false;
    } finally {
        if (serverStatus !== 'ERROR') setServerStatus('IDLE');
    }
  };

  // --- Effect: Analyze Current Pair Immediately on Change AND Loop every 10s ---
  useEffect(() => {
      // 1. Immediate fetch
      performAnalysis(currentPair);

      // 2. Scheduled refresh every 10 seconds for the UI/Chart and Order Checks
      const interval = setInterval(() => {
          performAnalysis(currentPair);
      }, 10000);

      return () => clearInterval(interval);
      // We include trades/portfolio in deps to ensure handleTradingLogic inside performAnalysis
      // has access to fresh state, restarting the timer after every update.
  }, [currentPair, trades, portfolio, learningState]); 

  // --- Effect: Background Trading Loop (For OTHER pairs) ---
  useEffect(() => {
    if (!active) return;

    const runTradingCycle = async () => {
        const randomPair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
        // Only analyze if it's NOT the current pair (since current pair has its own dedicated 10s loop)
        if (randomPair !== currentPair) {
            await performAnalysis(randomPair);
        }
    };

    const interval = setInterval(runTradingCycle, 4000); // Check background pairs every 4s
    return () => clearInterval(interval);
  }, [active, portfolio, trades, currentPair, learningState, externalConfigs]); 

  // --- LEARNING FUNCTION ---
  const learnFromTrade = (trade: Trade, pnlValue: number) => {
      const isWin = pnlValue > 0;
      const strategy = trade.strategyUsed || 'Balanced';
      let w = { ...learningState.weights };
      const rate = learningState.learningRate;
      
      let msg = "";
      
      if (strategy === 'Aggressive') {
          w.aggressive += isWin ? rate : -rate;
          msg = `Brain: Aggressive w ${isWin ? 'increased' : 'decreased'} to ${w.aggressive.toFixed(2)}`;
      } else if (strategy === 'Conservative') {
          w.conservative += isWin ? rate : -rate;
          msg = `Brain: Conservative w ${isWin ? 'increased' : 'decreased'} to ${w.conservative.toFixed(2)}`;
      } else if (strategy === 'Trend Follower') {
          w.trend += isWin ? rate : -rate;
          msg = `Brain: Trend w ${isWin ? 'increased' : 'decreased'} to ${w.trend.toFixed(2)}`;
      } else {
           if(isWin) { w.trend += rate/2; w.conservative += rate/2; }
           else { w.trend -= rate/2; w.conservative -= rate/2; }
           msg = "Brain: General weights adjusted";
      }

      w.aggressive = Math.max(0.1, Math.min(3, w.aggressive));
      w.conservative = Math.max(0.1, Math.min(3, w.conservative));
      w.trend = Math.max(0.1, Math.min(3, w.trend));

      setLearningState(prev => ({
          ...prev,
          weights: w,
          epoch: prev.epoch + 1,
          lastCorrection: Date.now()
      }));

      addLog(msg, 'warn');
  };

  const handleTradingLogic = (pair: string, currentPrice: number, analysis: AIAnalysisResult) => {
      let updatedTrades = [...trades];
      let updatedPortfolio = { ...portfolio };
      let stateChanged = false;

      updatedTrades = updatedTrades.map(trade => {
          if (trade.status === 'CLOSED' || trade.pair !== pair) return trade;
          
          let closeReason = null;
          let pnlValue = 0;
          const isLong = trade.type === PositionType.LONG;

          if (isLong) {
              if (currentPrice >= trade.takeProfit) closeReason = 'TP Hit';
              else if (currentPrice <= trade.stopLoss) closeReason = 'SL Hit';
          } else {
              if (currentPrice <= trade.takeProfit) closeReason = 'TP Hit';
              else if (currentPrice >= trade.stopLoss) closeReason = 'SL Hit';
          }

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
              
              learnFromTrade(trade, finalPnL);

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

      const hasPosition = updatedTrades.some(t => t.pair === pair && t.status === 'OPEN');
      if (!hasPosition && analysis.decision !== 'HOLD' && analysis.confidence > 70) {
          const riskAmount = updatedPortfolio.balance * 0.1; 
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
                  pnlValue: 0,
                  strategyUsed: analysis.dominantPersona
              };

              updatedTrades.push(newTrade);
              updatedPortfolio.balance -= riskAmount;
              updatedPortfolio.usedMargin += riskAmount;
              
              addLog(`OPEN ${type} ${pair} @ ${currentPrice.toFixed(2)} [${analysis.dominantPersona}]`, 'info');
          }
      }

      let floatingPnL = 0;
      updatedTrades.filter(t => t.status === 'OPEN').forEach(t => floatingPnL += (t.pnlValue || 0));
      updatedPortfolio.equity = updatedPortfolio.balance + updatedPortfolio.usedMargin + floatingPnL;

      if (stateChanged) {
          setTrades(updatedTrades);
          setPortfolio(updatedPortfolio);
      }
  };

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
  const globalSentiment = lastAnalysis[currentPair]?.externalSentiment || 0;

  const containerStyle = { color: 'white', minHeight: '100vh', backgroundColor: '#0f172a' };

  // --- Sub Component: Dashboard Tab ---
  const AnalysisVisualizer = ({ pair }: { pair: string }) => {
      const analysis = lastAnalysis[pair];
      const mData = marketData[pair];
      if (!analysis || !mData || !mData.indicators) return <div className="p-8 text-center text-gray-500">No Analysis Data Yet</div>;

      const ind = mData.indicators;
      
      const SignalBar = ({ label, val, min, max, optimal, invert = false }: any) => {
          const norm = Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
          return (
              <div className="mb-2">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>{label}</span>
                      <span className="font-mono text-white">{val.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full ${norm > 50 ? (invert ? 'bg-rose-500':'bg-emerald-500') : (invert ? 'bg-emerald-500':'bg-rose-500')}`} style={{width: `${norm}%`}}></div>
                  </div>
              </div>
          );
      };

      return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in zoom-in duration-300">
             {/* 1. Verdict Card */}
             <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10"><BrainCircuit size={64}/></div>
                 <h4 className="text-gray-400 text-xs uppercase font-bold mb-4">Neural Verdict</h4>
                 <div className="flex items-center gap-4 mb-4">
                     <div className={`text-3xl font-bold ${analysis.decision === 'BUY' ? 'text-emerald-400' : analysis.decision === 'SELL' ? 'text-rose-400' : 'text-gray-400'}`}>
                         {analysis.decision}
                     </div>
                     <div className="text-sm font-mono bg-gray-900 px-2 py-1 rounded border border-gray-700">
                         Conf: {analysis.confidence}%
                     </div>
                 </div>
                 <div className="text-xs text-gray-300 leading-relaxed bg-gray-900/50 p-3 rounded mb-3 border border-gray-700/50">
                     {analysis.reasoning}
                 </div>
                 <div className="flex gap-2 mt-2">
                     <div className="flex-1 bg-gray-900 p-2 rounded text-center">
                         <div className="text-[10px] text-gray-500">Dominant Persona</div>
                         <div className="text-xs font-bold text-indigo-400">{analysis.dominantPersona}</div>
                     </div>
                 </div>
             </div>

             {/* 2. Key Indicators */}
             <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg">
                 <h4 className="text-gray-400 text-xs uppercase font-bold mb-4 flex items-center gap-2"><Activity size={12}/> Oscillators</h4>
                 <SignalBar label="RSI (14)" val={ind.rsi} min={0} max={100} />
                 <SignalBar label="Stoch K" val={ind.stoch.k} min={0} max={100} />
                 <SignalBar label="MFI" val={ind.mfi} min={0} max={100} />
                 <SignalBar label="CCI" val={ind.cci + 100} min={0} max={200} />
                 <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 gap-2">
                     <div className="text-center">
                         <div className="text-[10px] text-gray-500">MACD Hist</div>
                         <div className={`font-bold font-mono ${ind.macd.histogram > 0 ? 'text-emerald-400':'text-rose-400'}`}>{ind.macd.histogram.toFixed(4)}</div>
                     </div>
                     <div className="text-center">
                         <div className="text-[10px] text-gray-500">AO</div>
                         <div className={`font-bold font-mono ${ind.ao > 0 ? 'text-emerald-400':'text-rose-400'}`}>{ind.ao.toFixed(4)}</div>
                     </div>
                 </div>
             </div>

             {/* 3. Trend & Volatility */}
             <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg">
                 <h4 className="text-gray-400 text-xs uppercase font-bold mb-4 flex items-center gap-2"><TrendingUp size={12}/> Trend / Volatility</h4>
                 
                 <div className="flex justify-between items-center mb-3 p-2 bg-gray-900 rounded border border-gray-700/50">
                     <span className="text-xs text-gray-400">SuperTrend</span>
                     <span className={`text-xs font-bold ${ind.superTrend.direction === 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                         {ind.superTrend.direction === 1 ? 'BULLISH' : 'BEARISH'}
                     </span>
                 </div>

                 <div className="flex justify-between items-center mb-3 p-2 bg-gray-900 rounded border border-gray-700/50">
                     <span className="text-xs text-gray-400">VWAP Relation</span>
                     <span className={`text-xs font-bold ${mData.price > ind.vwap ? 'text-emerald-400' : 'text-rose-400'}`}>
                         {mData.price > ind.vwap ? 'PRICE > VWAP' : 'PRICE < VWAP'}
                     </span>
                 </div>

                 <div className="flex justify-between items-center mb-3 p-2 bg-gray-900 rounded border border-gray-700/50">
                     <span className="text-xs text-gray-400">Ichimoku</span>
                     <span className={`text-xs font-bold ${ind.ichimoku.tenkan > ind.ichimoku.kijun ? 'text-emerald-400' : 'text-rose-400'}`}>
                         {ind.ichimoku.tenkan > ind.ichimoku.kijun ? 'Tenkan > Kijun' : 'Tenkan < Kijun'}
                     </span>
                 </div>
                 
                 <div className="mt-2 text-[10px] text-gray-500 text-center">ADX Strength: {ind.adx.toFixed(1)}</div>
             </div>

             {/* 4. External Intelligence Summary */}
             <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Globe size={64}/></div>
                 <h4 className="text-gray-400 text-xs uppercase font-bold mb-4 flex justify-between items-center">
                     <span>External Intel</span>
                     <button onClick={() => setShowSignalSettings(true)} className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 bg-gray-900 px-2 py-1 rounded">
                         <Settings size={10} /> Keys
                     </button>
                 </h4>
                 
                 <div className="space-y-2 max-h-[110px] overflow-y-auto pr-1 scrollbar-hide mb-3">
                     {externalSignals.filter(s => s.status !== 'DISABLED').length === 0 ? (
                         <div className="text-center text-gray-500 text-xs italic py-4">No active connections</div>
                     ) : (
                         externalSignals.filter(s => s.status !== 'DISABLED').slice(0, 3).map(s => (
                             <div key={s.providerId} className="flex justify-between items-center p-2 bg-gray-900/50 rounded border border-gray-700/50">
                                 <div className="flex items-center gap-2">
                                     <span className={`w-2 h-2 rounded-full ${s.sentiment > 0.2 ? 'bg-emerald-500' : s.sentiment < -0.2 ? 'bg-rose-500' : 'bg-gray-500'}`}></span>
                                     <span className="text-[10px] text-gray-300 font-bold truncate max-w-[80px]">{s.name}</span>
                                 </div>
                                 <div className="text-right flex items-center gap-2">
                                     {s.status === 'AUTH_FAILED' ? (
                                        <span className="text-[9px] text-rose-500 font-bold">AUTH ERR</span>
                                     ) : (
                                        <div className={`text-xs font-mono font-bold ${s.sentiment > 0 ? 'text-emerald-400' : s.sentiment < 0 ? 'text-rose-400' : 'text-gray-400'}`}>
                                            {s.sentiment > 0 ? 'BUY' : s.sentiment < 0 ? 'SELL' : 'HOLD'}
                                        </div>
                                     )}
                                 </div>
                             </div>
                         ))
                     )}
                 </div>
                 
                 <button onClick={() => setShowIntelligenceDashboard(true)} className="w-full mt-auto py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 rounded text-xs font-bold flex items-center justify-center gap-2 transition-all">
                    <Network size={12} /> Open Matrix Dashboard
                 </button>
             </div>
          </div>
      );
  };

  const [dashboardTab, setDashboardTab] = useState(PAIRS[0]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-2 md:p-4 pb-20" style={containerStyle}>
      {/* MODALS */}
      {showSignalSettings && (
          <SignalSettings 
             configs={externalConfigs} 
             onSave={setExternalConfigs} 
             onClose={() => setShowSignalSettings(false)} 
          />
      )}

      {showIntelligenceDashboard && (
          <IntelligenceDashboard 
             signals={externalSignals} 
             globalSentiment={globalSentiment} 
             onClose={() => setShowIntelligenceDashboard(false)} 
          />
      )}

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
            <div className="flex items-center gap-3 mt-1">
               <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors ${
                   gateStatus === 'OK' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
                   gateStatus === 'ERROR' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 
                   'bg-gray-700/50 text-gray-400 border-gray-600'
               }`}>
                 {gateStatus === 'OK' ? <CheckCircle2 size={12} /> : gateStatus === 'ERROR' ? <XCircle size={12} /> : <Loader2 size={12} className="animate-spin" />}
                 GATE.IO / BINANCE
               </span>
               <span className="text-[10px] text-gray-500 font-mono">
                   EPOCH: {learningState.epoch}
               </span>
               <button onClick={() => setShowIntelligenceDashboard(true)} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border bg-indigo-900/30 border-indigo-500/30 text-indigo-400 hover:bg-indigo-900/50 transition-colors animate-pulse">
                   <Network size={10} /> Matrix Active
               </button>
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
                
                {gateStatus === 'ERROR' && currentData.candles.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-rose-400">
                        <WifiOff size={48} className="mb-4" />
                        <p className="text-lg font-bold">Нет подключения к данным</p>
                        <p className="text-sm text-rose-300/60 mt-2">API Недоступен (404) или заблокирован.</p>
                        <p className="text-xs text-gray-500 mt-4">Проверьте netlify.toml и деплой функций</p>
                    </div>
                ) : (
                    <MarketChart 
                        data={currentData.candles} 
                        indicators={currentData.indicators} 
                        currentPrice={currentData.price} 
                        activeTrade={activeTrade}
                        suggestedLevels={currentAnalysis?.decision !== 'HOLD' ? {sl: currentAnalysis?.recommendedSL || 0, tp: currentAnalysis?.recommendedTP || 0} : undefined}
                    />
                )}
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
             {currentData.indicators ? <IndicatorCard indicators={currentData.indicators} /> : <div className="text-center text-gray-500 text-sm py-4">Ожидание данных для анализа...</div>}
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
        /* --- NEW DASHBOARD VIEW (MATRIX) --- */
        <div className="space-y-6">
           {/* Top Navigation for Matrix */}
           <div className="flex overflow-x-auto space-x-2 pb-2 border-b border-gray-700">
               {PAIRS.map(pair => (
                   <button 
                      key={pair}
                      onClick={() => setDashboardTab(pair)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dashboardTab === pair ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                   >
                       {pair.split('_')[0]}
                       {lastAnalysis[pair]?.decision === 'BUY' && <span className="ml-2 w-2 h-2 bg-emerald-400 rounded-full inline-block"></span>}
                   </button>
               ))}
           </div>

           {/* Detailed Visualizer for Selected Pair */}
           <AnalysisVisualizer pair={dashboardTab} />

           {/* Global Summary Table below visuals */}
           <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-xl mt-8 opacity-60 hover:opacity-100 transition-opacity">
                <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                    <h3 className="font-bold text-white flex items-center gap-2"><Eye size={16}/> Quick Summary</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                            <tr>
                                <th className="p-4">Pair</th>
                                <th className="p-4">Strategy</th>
                                <th className="p-4">Conf</th>
                                <th className="p-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {PAIRS.map(pair => {
                                const analysis = lastAnalysis[pair];
                                return (
                                <tr key={pair} className="hover:bg-gray-700/30">
                                    <td className="p-4 font-bold font-mono text-white">{pair.split('_')[0]}</td>
                                    <td className="p-4 text-xs text-indigo-300">{analysis?.dominantPersona || '-'}</td>
                                    <td className="p-4">{analysis ? `${analysis.confidence}%` : '-'}</td>
                                    <td className="p-4">
                                        {analysis && <span className={`px-2 py-1 rounded text-xs font-bold ${analysis.decision === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : analysis.decision === 'SELL' ? 'bg-rose-500/20 text-rose-400' : 'bg-gray-600/20 text-gray-400'}`}>
                                            {analysis.decision}
                                        </span>}
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
