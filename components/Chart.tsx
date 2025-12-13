import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Bar, Area, ReferenceLine, Brush } from 'recharts';
import { Candle, IndicatorValues, Trade } from '../types';
import { Eye, EyeOff } from 'lucide-react';

interface ChartProps {
  data: Candle[];
  indicators: IndicatorValues | null;
  currentPrice: number;
  activeTrade?: Trade;
  suggestedLevels?: { sl: number; tp: number };
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-gray-900/90 border border-gray-700 p-3 rounded-lg shadow-2xl backdrop-blur text-xs z-50">
        <div className="font-mono text-gray-400 mb-2 border-b border-gray-700 pb-1">
          {new Date(d.time).toLocaleTimeString()}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-gray-500">Open:</span> <span className="text-white font-mono">{d.open.toFixed(2)}</span>
            <span className="text-gray-500">High:</span> <span className="text-emerald-400 font-mono">{d.high.toFixed(2)}</span>
            <span className="text-gray-500">Low:</span> <span className="text-rose-400 font-mono">{d.low.toFixed(2)}</span>
            <span className="text-gray-500">Close:</span> <span className="text-blue-400 font-bold font-mono">{d.close.toFixed(2)}</span>
            <span className="text-gray-500">Vol:</span> <span className="text-gray-300 font-mono">{d.volume.toFixed(2)}</span>
        </div>
      </div>
    );
  }
  return null;
};

// Helper to convert standard candles to Heikin Ashi
const calculateHeikinAshi = (data: Candle[]) => {
    const haData = [];
    if(data.length === 0) return [];
    
    // First candle is same
    haData.push({...data[0]});

    for(let i=1; i<data.length; i++) {
        const prev = haData[i-1];
        const curr = data[i];
        
        const haClose = (curr.open + curr.high + curr.low + curr.close) / 4;
        const haOpen = (prev.open + prev.close) / 2;
        const haHigh = Math.max(curr.high, haOpen, haClose);
        const haLow = Math.min(curr.low, haOpen, haClose);
        
        haData.push({
            ...curr,
            open: haOpen,
            high: haHigh,
            low: haLow,
            close: haClose
        });
    }
    return haData;
};

export const MarketChart = ({ data, indicators, currentPrice, activeTrade, suggestedLevels }: ChartProps) => {
  const [useHeikinAshi, setUseHeikinAshi] = useState(false);
  const [showOverlays, setShowOverlays] = useState(true);

  const chartData = useMemo(() => {
      if(!data || data.length === 0) return [];
      return useHeikinAshi ? calculateHeikinAshi(data) : data;
  }, [data, useHeikinAshi]);

  // Calculate dynamic domain strictly based on min/max of visible data
  const yDomain = useMemo(() => {
     if (!data || data.length === 0) return ['auto', 'auto'];
     const lows = data.map(d => d.low);
     const highs = data.map(d => d.high);
     const min = Math.min(...lows);
     const max = Math.max(...highs);
     // Add very small padding (0.1%)
     const padding = (max - min) * 0.05;
     return [min - padding, max + padding];
  }, [data]);

  if (!data || data.length === 0) return <div className="h-full flex items-center justify-center text-gray-500">Загрузка графика...</div>;

  return (
    <div className="relative group h-[450px]">
        {/* Chart Controls */}
        <div className="absolute top-2 left-16 z-10 flex gap-2">
            <button 
                onClick={() => setUseHeikinAshi(!useHeikinAshi)}
                className={`text-[10px] px-2 py-1 rounded border ${useHeikinAshi ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}
            >
                {useHeikinAshi ? 'Heikin Ashi' : 'Candles'}
            </button>
            <button 
                onClick={() => setShowOverlays(!showOverlays)}
                className={`text-[10px] px-2 py-1 rounded border flex items-center gap-1 ${showOverlays ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}
            >
                {showOverlays ? <Eye size={10}/> : <EyeOff size={10}/>} Indicators
            </button>
        </div>

    <div className="h-full w-full select-none">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1f2937" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#1f2937" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          
          <XAxis 
            dataKey="time" 
            tickFormatter={(time) => new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            stroke="#374151"
            tick={{fill: '#9ca3af', fontSize: 10}}
            minTickGap={50}
          />
          <YAxis 
            domain={yDomain} // Force strictly calculated domain
            stroke="#374151"
            tick={{fill: '#9ca3af', fontSize: 10}}
            width={60}
            orientation="right"
            tickFormatter={(val) => val.toFixed(2)}
            type="number"
            allowDataOverflow={true} // Critical for zooming/scaling correctly without including 0
            scale="linear"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '4 4' }} />
          
          {/* Volume (Background) */}
          <Bar dataKey="volume" yAxisId={0} fill="url(#colorVolume)" barSize={4} />

          {/* Price Line Area */}
          <Area 
            type="monotone" 
            dataKey="close" 
            stroke={useHeikinAshi ? "#818cf8" : "#6366f1"} 
            strokeWidth={2} 
            fillOpacity={1} 
            fill="url(#colorPrice)" 
            isAnimationActive={false}
          />
          
          {/* Overlays */}
          {showOverlays && indicators && (
              <>
                 <ReferenceLine y={indicators.bollinger.upper} stroke="#10b981" strokeDasharray="3 3" opacity={0.3} />
                 <ReferenceLine y={indicators.bollinger.lower} stroke="#10b981" strokeDasharray="3 3" opacity={0.3} />
                 <ReferenceLine y={indicators.emaShort} stroke="#f59e0b" strokeWidth={1} opacity={0.6} />
                 <ReferenceLine y={indicators.emaLong} stroke="#3b82f6" strokeWidth={1} opacity={0.6} />
                 <ReferenceLine y={indicators.vwap} stroke="#ec4899" strokeWidth={2} opacity={0.5} />
              </>
          )}

          {/* CURRENT PRICE LINE */}
          <ReferenceLine 
            y={currentPrice} 
            stroke="#f43f5e" 
            strokeDasharray="3 3" 
            label={{ position: 'right', value: currentPrice.toFixed(2), fill: '#f43f5e', fontSize: 10, fillOpacity: 1, fontWeight: 'bold',  backgroundColor: '#1f2937' }} 
            isFront={true}
          />

          {/* ACTIVE TRADE LINES */}
          {activeTrade && (
            <>
              <ReferenceLine y={activeTrade.entryPrice} stroke="#fbbf24" strokeWidth={1} strokeDasharray="5 5" label={{ value: 'ENTRY', position: 'left', fill: '#fbbf24', fontSize: 10}} />
              <ReferenceLine y={activeTrade.takeProfit} stroke="#34d399" strokeWidth={1} label={{ value: `TP`, position: 'left', fill: '#34d399', fontSize: 10}} />
              <ReferenceLine y={activeTrade.stopLoss} stroke="#f43f5e" strokeWidth={1} label={{ value: 'SL', position: 'left', fill: '#f43f5e', fontSize: 10}} />
            </>
          )}

          {/* ZOOM SLIDER */}
          <Brush 
             dataKey="time" 
             height={30} 
             stroke="#4b5563"
             fill="#1f2937"
             tickFormatter={() => ''}
             travellerWidth={10}
          />

        </ComposedChart>
      </ResponsiveContainer>
    </div>
    </div>
  );
};