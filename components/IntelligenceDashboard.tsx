
import React from 'react';
import { ExternalSignalResult } from '../types';
import { X, Server, Activity, Clock, ShieldCheck, AlertTriangle, Zap } from 'lucide-react';

interface Props {
    signals: ExternalSignalResult[];
    globalSentiment: number;
    onClose: () => void;
}

export const IntelligenceDashboard = ({ signals, globalSentiment, onClose }: Props) => {
    
    // Sort: Active first, then disabled
    const sortedSignals = [...signals].sort((a, b) => {
        if (a.status === 'OK' && b.status !== 'OK') return -1;
        if (a.status !== 'OK' && b.status === 'OK') return 1;
        return 0;
    });

    return (
        <div className="fixed inset-0 bg-gray-950 z-[90] overflow-y-auto animate-in fade-in duration-300">
             {/* Sticky Header */}
             <div className="sticky top-0 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 p-4 flex justify-between items-center z-10">
                 <div className="flex items-center gap-4">
                     <div className="p-3 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
                         <Activity className="text-white" size={24} />
                     </div>
                     <div>
                         <h1 className="text-2xl font-bold text-white tracking-tight">Global Intelligence Matrix</h1>
                         <p className="text-gray-400 text-sm">Real-time aggregated data from external neural networks.</p>
                     </div>
                 </div>
                 
                 <div className="flex items-center gap-6">
                     <div className="text-right">
                         <div className="text-xs text-gray-500 uppercase tracking-widest">Global Trend</div>
                         <div className={`text-2xl font-bold font-mono ${globalSentiment > 0.1 ? 'text-emerald-400' : globalSentiment < -0.1 ? 'text-rose-400' : 'text-gray-200'}`}>
                             {globalSentiment > 0 ? '+' : ''}{globalSentiment.toFixed(4)}
                         </div>
                     </div>
                     <button onClick={onClose} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-white transition-colors">
                         <X size={24} />
                     </button>
                 </div>
             </div>

             {/* Main Content */}
             <div className="p-6 md:p-8 max-w-7xl mx-auto">
                 
                 {/* Status Grid */}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {sortedSignals.map((signal) => {
                         const isAuthFailed = signal.status === 'AUTH_FAILED';
                         const isError = signal.status === 'ERROR';
                         const isDisabled = signal.status === 'DISABLED';
                         const isOk = signal.status === 'OK';
                         
                         let statusColor = "border-gray-800 bg-gray-900";
                         if (isOk) statusColor = "border-emerald-500/30 bg-emerald-900/10";
                         if (isAuthFailed) statusColor = "border-rose-500/50 bg-rose-900/10";
                         if (isDisabled) statusColor = "border-gray-800 bg-gray-900 opacity-50";

                         return (
                             <div key={signal.providerId} className={`rounded-xl border p-5 relative overflow-hidden group ${statusColor}`}>
                                 {/* Background Decor */}
                                 <div className="absolute top-0 right-0 p-4 opacity-5">
                                     <Server size={64} />
                                 </div>

                                 <div className="flex justify-between items-start mb-4 relative z-10">
                                     <div className="flex items-center gap-2">
                                         <div className={`w-2 h-2 rounded-full ${isOk ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`}></div>
                                         <h3 className="font-bold text-white text-lg">{signal.name}</h3>
                                     </div>
                                     <div className={`px-2 py-1 rounded text-[10px] font-bold border ${isOk ? 'border-emerald-500/30 text-emerald-400' : 'border-gray-600 text-gray-500'}`}>
                                         {signal.status}
                                     </div>
                                 </div>

                                 {/* Main Metrics */}
                                 <div className="grid grid-cols-2 gap-4 mb-4 relative z-10">
                                     <div className="bg-black/30 p-3 rounded-lg border border-gray-700/30">
                                         <div className="text-[10px] text-gray-400 uppercase">Sentiment</div>
                                         <div className={`text-xl font-mono font-bold ${signal.sentiment > 0 ? 'text-emerald-400' : signal.sentiment < 0 ? 'text-rose-400' : 'text-gray-400'}`}>
                                             {signal.sentiment.toFixed(2)}
                                         </div>
                                     </div>
                                     <div className="bg-black/30 p-3 rounded-lg border border-gray-700/30">
                                         <div className="text-[10px] text-gray-400 uppercase">Confidence</div>
                                         <div className="text-xl font-mono font-bold text-indigo-400">
                                             {signal.confidence}%
                                         </div>
                                     </div>
                                 </div>

                                 {/* Details / Logs */}
                                 <div className="bg-black/50 p-3 rounded border border-gray-700/50 min-h-[60px] relative z-10">
                                     <div className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                                         <Zap size={10} /> Latest Response
                                     </div>
                                     <div className="text-xs text-gray-300 font-mono leading-relaxed">
                                         {isAuthFailed ? "Access Denied: Check API Credentials" : signal.details || "No Data"}
                                     </div>
                                 </div>

                                 {/* Footer */}
                                 <div className="mt-4 flex justify-between items-center text-[10px] text-gray-500 relative z-10">
                                     <div className="flex items-center gap-1">
                                         <Clock size={10} /> Updated: {signal.lastUpdated ? new Date(signal.lastUpdated).toLocaleTimeString() : '--:--'}
                                     </div>
                                     <div className="flex items-center gap-1">
                                         <Activity size={10} /> Latency: {signal.latencyMs || 0}ms
                                     </div>
                                 </div>
                             </div>
                         );
                     })}
                 </div>

                 {/* System Log / Aggregation Info */}
                 <div className="mt-8 bg-gray-900 rounded-xl border border-gray-800 p-6">
                     <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                         <ShieldCheck className="text-indigo-500" /> Aggregation Logic
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-400">
                         <p>
                             The system aggregates data using a weighted average based on the <b>Confidence Score</b> reported by each external provider. 
                             Providers with higher latency or lower historical accuracy are assigned lower weights dynamically.
                         </p>
                         <p>
                             Authentication is handled via secure local proxy. Keys are never stored on a centralized server. 
                             If a provider returns an "AUTH_FAILED" status, it is automatically excluded from the Global Trend calculation.
                         </p>
                     </div>
                 </div>
             </div>
        </div>
    );
};
