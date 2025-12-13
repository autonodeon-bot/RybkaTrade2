import React from 'react';
import { Portfolio } from '../types';
import { Wallet, TrendingUp, Lock, DollarSign, Percent, BarChart } from 'lucide-react';

export const PortfolioCard = ({ portfolio }: { portfolio: Portfolio }) => {
  const isProfit = portfolio.totalProfit >= 0;
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden group">
        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet size={48} />
        </div>
        <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Balance</div>
        <div className="text-xl lg:text-2xl font-bold text-white font-mono">${portfolio.balance.toFixed(2)}</div>
        <div className="text-[10px] text-gray-500 mt-1">Cash Available</div>
      </div>

      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden group">
        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign size={48} />
        </div>
        <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Equity</div>
        <div className={`text-xl lg:text-2xl font-bold font-mono ${portfolio.equity >= portfolio.balance ? 'text-emerald-400' : 'text-rose-400'}`}>
            ${portfolio.equity.toFixed(2)}
        </div>
        <div className="text-[10px] text-gray-500 mt-1">Incl. Floating PnL</div>
      </div>

      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden group">
        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Lock size={48} />
        </div>
        <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Used Margin</div>
        <div className="text-xl lg:text-2xl font-bold text-yellow-400 font-mono">${portfolio.usedMargin.toFixed(2)}</div>
        <div className="text-[10px] text-gray-500 mt-1">Locked in Trades</div>
      </div>

      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden group">
        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={48} />
        </div>
        <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Profit</div>
        <div className={`text-xl lg:text-2xl font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isProfit ? '+' : ''}{portfolio.totalProfit.toFixed(2)}
        </div>
        <div className="text-[10px] text-gray-500 mt-1">All Time PnL</div>
      </div>

      {/* NEW STATS */}
      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden group">
         <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Percent size={48} />
        </div>
        <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Win Rate</div>
        <div className="text-xl lg:text-2xl font-bold text-blue-400 font-mono">
            {portfolio.winRate ? portfolio.winRate.toFixed(1) : 0}%
        </div>
        <div className="text-[10px] text-gray-500 mt-1">{portfolio.tradesCount || 0} Trades</div>
      </div>

      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden group">
         <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <BarChart size={48} />
        </div>
        <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Profit Factor</div>
        <div className="text-xl lg:text-2xl font-bold text-purple-400 font-mono">
            {portfolio.profitFactor ? portfolio.profitFactor.toFixed(2) : '0.00'}
        </div>
        <div className="text-[10px] text-gray-500 mt-1">Gross Profit / Loss</div>
      </div>
    </div>
  );
};