
import React from 'react';
import { ExternalProviderConfig } from '../types';
import { X, Save, Key, Globe, Shield, Lock, Eye, EyeOff } from 'lucide-react';

interface Props {
    configs: ExternalProviderConfig[];
    onSave: (configs: ExternalProviderConfig[]) => void;
    onClose: () => void;
}

export const SignalSettings = ({ configs, onSave, onClose }: Props) => {
    const [localConfigs, setLocalConfigs] = React.useState<ExternalProviderConfig[]>(configs);
    const [showSecrets, setShowSecrets] = React.useState<Record<string, boolean>>({});

    const toggle = (id: string) => {
        setLocalConfigs(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
    };

    const updateField = (id: string, field: 'apiKey' | 'apiSecret', value: string) => {
        setLocalConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleSave = () => {
        onSave(localConfigs);
        onClose();
    };

    const toggleSecret = (id: string) => {
        setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Shield className="text-emerald-500" /> Secure API Gateway
                        </h2>
                        <p className="text-gray-400 text-xs mt-1">Configure external intelligence providers with your personal credentials.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {localConfigs.map(cfg => (
                        <div key={cfg.id} className={`p-5 rounded-xl border transition-all duration-300 ${cfg.enabled ? 'bg-gray-800/80 border-indigo-500/30 shadow-lg shadow-indigo-900/10' : 'bg-gray-900 border-gray-800 opacity-60'}`}>
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${cfg.enabled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-800 text-gray-600'}`}>
                                        <Globe size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">{cfg.name}</h3>
                                        <p className="text-xs text-gray-400">{cfg.description}</p>
                                    </div>
                                </div>
                                
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={cfg.enabled} onChange={() => toggle(cfg.id)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            {/* Inputs Area */}
                            {cfg.enabled && (
                                <div className="space-y-3 pl-2 border-l-2 border-gray-700 ml-4 mt-2 animate-in slide-in-from-top-2 duration-300">
                                    {/* API Key Field */}
                                    {cfg.id !== 'COINGECKO' && (
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">API Public Key</label>
                                            <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-gray-700 focus-within:border-indigo-500 transition-colors">
                                                <Key size={14} className="text-gray-500" />
                                                <input 
                                                    type="text" 
                                                    placeholder={`Enter ${cfg.name} Public Key`}
                                                    value={cfg.apiKey || ''}
                                                    onChange={(e) => updateField(cfg.id, 'apiKey', e.target.value)}
                                                    className="bg-transparent border-none outline-none text-xs text-white w-full placeholder-gray-600 font-mono"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* API Secret Field (if required) */}
                                    {cfg.requiresSecret && (
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">API Private Secret / Password</label>
                                            <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-gray-700 focus-within:border-rose-500 transition-colors">
                                                <Lock size={14} className="text-gray-500" />
                                                <input 
                                                    type={showSecrets[cfg.id] ? "text" : "password"}
                                                    placeholder={`Enter ${cfg.name} Secret`}
                                                    value={cfg.apiSecret || ''}
                                                    onChange={(e) => updateField(cfg.id, 'apiSecret', e.target.value)}
                                                    className="bg-transparent border-none outline-none text-xs text-white w-full placeholder-gray-600 font-mono"
                                                />
                                                <button onClick={() => toggleSecret(cfg.id)} className="text-gray-500 hover:text-white">
                                                    {showSecrets[cfg.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {cfg.id === 'COINGECKO' && <div className="text-xs text-emerald-400 font-mono">Status: Public Access Active</div>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-gray-950 flex justify-between items-center">
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                        <Lock size={12} /> Credentials are stored locally in your browser.
                    </div>
                    <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-indigo-900/30">
                        <Save size={16} /> Save & Connect
                    </button>
                </div>
            </div>
        </div>
    );
};
