import React from 'react';
import { OrderBookState } from '../types';

export const OrderBook = ({ data }: { data?: OrderBookState }) => {
  if (!data || !data.asks || !data.bids) return (
      <div className="h-full flex items-center justify-center text-gray-500 text-xs">Loading Order Book...</div>
  );

  const maxTotal = Math.max(
      ...data.bids.map(b => b.amount), 
      ...data.asks.map(a => a.amount)
  ) * 1.5;

  return (
    <div className="flex flex-col h-full overflow-hidden text-[10px] font-mono">
        <div className="grid grid-cols-3 text-gray-500 mb-1 px-1">
            <span>Price</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Total</span>
        </div>
        
        {/* ASKS (Sells) - Red - Reversed order to show lowest ask at bottom */}
        <div className="flex-1 flex flex-col justify-end overflow-hidden mb-1">
            {data.asks.slice(-8).map((ask, i) => (
                <div key={i} className="relative flex justify-between items-center px-1 py-0.5 hover:bg-gray-800 cursor-pointer group">
                     {/* Depth Bar */}
                    <div 
                        className="absolute right-0 top-0 bottom-0 bg-rose-900/20 z-0 transition-all duration-300"
                        style={{ width: `${(ask.amount / maxTotal) * 100}%` }}
                    />
                    <span className="text-rose-400 z-10 group-hover:font-bold">{ask.price.toFixed(2)}</span>
                    <span className="text-gray-400 z-10">{ask.amount.toFixed(4)}</span>
                    <span className="text-gray-500 z-10">{(ask.price * ask.amount).toFixed(0)}</span>
                </div>
            ))}
        </div>

        {/* Spread */}
        <div className="text-center py-1 border-y border-gray-700 font-bold text-gray-300 bg-gray-800">
             SPREAD: {(data.asks[data.asks.length-1].price - data.bids[0].price).toFixed(2)}
        </div>

        {/* BIDS (Buys) - Green */}
        <div className="flex-1 overflow-hidden mt-1">
            {data.bids.slice(0, 8).map((bid, i) => (
                <div key={i} className="relative flex justify-between items-center px-1 py-0.5 hover:bg-gray-800 cursor-pointer group">
                     {/* Depth Bar */}
                    <div 
                        className="absolute right-0 top-0 bottom-0 bg-emerald-900/20 z-0 transition-all duration-300"
                        style={{ width: `${(bid.amount / maxTotal) * 100}%` }}
                    />
                    <span className="text-emerald-400 z-10 group-hover:font-bold">{bid.price.toFixed(2)}</span>
                    <span className="text-gray-400 z-10">{bid.amount.toFixed(4)}</span>
                    <span className="text-gray-500 z-10">{(bid.price * bid.amount).toFixed(0)}</span>
                </div>
            ))}
        </div>
    </div>
  );
};
