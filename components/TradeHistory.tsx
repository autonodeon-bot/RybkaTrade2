import React from 'react';
import { Trade, PositionType } from '../types';
import { ArrowUpCircle, ArrowDownCircle, Target, Shield, AlertTriangle } from 'lucide-react';

export const TradeHistory = ({ trades }: { trades: Trade[] }) => {
  if (trades.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 border border-dashed border-gray-700 rounded-lg">
        Нет активных или прошлых сделок. Система ожидает идеального входа (R/R &gt; 1.5)...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-gray-400">
        <thead className="bg-gray-800 text-xs uppercase font-medium text-gray-300">
          <tr>
            <th className="px-4 py-3">Pair</th>
            <th className="px-4 py-3">Side</th>
            <th className="px-4 py-3">Entry</th>
            <th className="px-4 py-3 text-emerald-400"><Target size={12} className="inline mr-1"/>TP</th>
            <th className="px-4 py-3 text-rose-400"><Shield size={12} className="inline mr-1"/>SL</th>
            <th className="px-4 py-3">PnL</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {trades.slice().reverse().map((trade) => {
             const isWin = (trade.pnl || 0) > 0;
             return (
            <tr key={trade.id} className="hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3 font-mono font-bold text-white">{trade.pair}</td>
              <td className="px-4 py-3">
                <span className={`flex items-center gap-1 font-bold ${trade.type === PositionType.LONG ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {trade.type === PositionType.LONG ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                  {trade.type}
                </span>
              </td>
              <td className="px-4 py-3 font-mono">${trade.entryPrice.toFixed(trade.entryPrice < 10 ? 4 : 2)}</td>
              <td className="px-4 py-3 font-mono text-emerald-500/80">${trade.takeProfit.toFixed(trade.entryPrice < 10 ? 4 : 2)}</td>
              <td className="px-4 py-3 font-mono text-rose-500/80">${trade.stopLoss.toFixed(trade.entryPrice < 10 ? 4 : 2)}</td>
              
              <td className={`px-4 py-3 font-mono font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                {trade.status === 'CLOSED' ? (
                  `${isWin ? '+' : ''}${trade.pnl?.toFixed(2)}%`
                ) : (
                  <span className="text-gray-500">...</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs">
                {trade.status === 'CLOSED' ? (
                   <span className={`px-2 py-0.5 rounded ${isWin ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                      {trade.reason.includes('TP') ? 'TAKE PROFIT' : trade.reason.includes('SL') ? 'STOP LOSS' : 'CLOSED'}
                   </span>
                ) : (
                   <div className="flex items-center gap-1 text-yellow-500 animate-pulse">
                      <ActivityIcon /> OPEN
                   </div>
                )}
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
};

const ActivityIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);