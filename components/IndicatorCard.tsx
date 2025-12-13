
import React from 'react';
import { IndicatorValues } from '../types';

const ValueItem = ({ label, value, sub, color }: { label: string, value: string | number, sub?: string, color?: string }) => (
  <div className="bg-gray-800 p-2 rounded border border-gray-700">
    <div className="text-[10px] text-gray-400 uppercase">{label}</div>
    <div className={`text-sm font-mono font-bold ${color || 'text-white'}`}>{value}</div>
    {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
  </div>
);

export const IndicatorCard = ({ indicators }: { indicators: IndicatorValues }) => {
  if (!indicators) return <div className="text-gray-500 text-sm italic">Ожидание данных...</div>;

  const stColor = indicators.superTrend.direction === 1 ? 'text-emerald-400' : 'text-rose-400';
  const aoColor = indicators.ao > 0 ? 'text-emerald-400' : 'text-rose-400';
  const rocColor = indicators.roc > 0 ? 'text-emerald-400' : 'text-rose-400';

  return (
    <div className="mt-4">
      <h4 className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-bold">20+ Technical Indicators</h4>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {/* Row 1: Oscillators */}
        <ValueItem label="RSI (14)" value={indicators.rsi.toFixed(1)} />
        <ValueItem label="Stoch K" value={indicators.stoch.k.toFixed(1)} />
        <ValueItem label="CCI" value={indicators.cci.toFixed(0)} />
        <ValueItem label="MFI" value={indicators.mfi.toFixed(1)} />
        <ValueItem label="Will %R" value={indicators.williamsR.toFixed(1)} />
        <ValueItem label="CMF" value={indicators.cmf.toFixed(2)} />
        
        {/* Row 2: Trend & Momentum */}
        <ValueItem label="MACD" value={indicators.macd.histogram.toFixed(3)} />
        <ValueItem label="AO" value={indicators.ao.toFixed(3)} color={aoColor} />
        <ValueItem label="Momentum" value={indicators.momentum.toFixed(2)} />
        <ValueItem label="ROC" value={indicators.roc.toFixed(2) + '%'} color={rocColor} />
        <ValueItem label="ADX" value={indicators.adx.toFixed(1)} />
        <ValueItem label="SuperTrend" value={indicators.superTrend.direction === 1 ? 'UP' : 'DOWN'} color={stColor} />

        {/* Row 3: Price & Volatility */}
        <ValueItem label="ATR" value={indicators.atr.toFixed(2)} />
        <ValueItem label="VWAP" value={indicators.vwap.toFixed(2)} />
        <ValueItem label="Ichimoku" value={`${indicators.ichimoku.tenkan.toFixed(1)}/${indicators.ichimoku.kijun.toFixed(1)}`} />
        <ValueItem label="PSAR" value={indicators.psar.toFixed(2)} />
        <ValueItem label="Keltner" value={indicators.keltner.upper.toFixed(2)} />
        <ValueItem label="Donchian" value={indicators.donchian.upper.toFixed(2)} />
      </div>
    </div>
  );
};
