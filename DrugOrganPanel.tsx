import React, { useRef, useEffect } from 'react';
import { DrugOrganEffect, DrugEffectType } from '../types';

const TYPE_CONFIG: Record<DrugEffectType, { label: string; color: string; bg: string; border: string }> = {
    stimulation: { label: 'Stimulation', color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    suppression: { label: 'Suppression', color: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    toxicity: { label: 'Toxicity', color: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/30' },
    'side-effect': { label: 'Side Effect', color: 'text-yellow-300', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
    relief: { label: 'Relief', color: 'text-purple-300', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
};

const ORGAN_ICONS: Record<string, string> = {
    'Brain': '🧠', 'Heart': '❤️', 'Liver': '🫁', 'Kidney': '🫘',
    'Lungs': '💨', 'Stomach': '🫃', 'Nervous System': '⚡', 'Muscles': '💪',
    'Skin': '🫀', 'Intestines': '🌀',
};

// Intensity → gradient bar color stops (matches 3D heatmap)
function intensityGradient(v: number): string {
    if (v < 0.25) return 'from-blue-500 to-cyan-400';
    if (v < 0.5) return 'from-cyan-400 to-green-400';
    if (v < 0.75) return 'from-yellow-400 to-orange-500';
    return 'from-orange-500 to-red-600';
}

function intensityLabel(v: number): { text: string; color: string } {
    if (v < 0.3) return { text: 'Low', color: 'text-blue-300' };
    if (v < 0.55) return { text: 'Moderate', color: 'text-yellow-300' };
    if (v < 0.8) return { text: 'High', color: 'text-orange-300' };
    return { text: 'Severe', color: 'text-red-400' };
}

interface DrugOrganPanelProps {
    effects: DrugOrganEffect[];
    mechanism: string;
    sideEffects: string[];
    contraindications: string[];
    longTermEffects: string[];
    riskLevel: 'Low' | 'Moderate' | 'High';
    drugName: string;
    category: string;
    selectedOrgan: string | null;
    onOrganSelect: (organ: string) => void;
}

const DrugOrganPanel: React.FC<DrugOrganPanelProps> = ({
    effects, mechanism, sideEffects, contraindications, longTermEffects,
    riskLevel, drugName, category, selectedOrgan, onOrganSelect
}) => {
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Auto-scroll to selected organ card
    useEffect(() => {
        if (selectedOrgan && cardRefs.current[selectedOrgan]) {
            cardRefs.current[selectedOrgan]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedOrgan]);

    const riskConfig = {
        Low: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
        Moderate: { color: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30' },
        High: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30' },
    }[riskLevel];

    return (
        <div className="flex flex-col h-full overflow-hidden text-white">
            {/* Drug header */}
            <div className="flex-shrink-0 p-4 border-b border-white/10">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-xl font-black text-white truncate">{drugName}</h3>
                        <span className="text-xs text-blue-300/70 font-medium px-2 py-0.5 bg-white/5 rounded-full border border-white/10">
                            {category}
                        </span>
                    </div>
                    <div className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border ${riskConfig.bg} ${riskConfig.color} ${riskConfig.border}`}>
                        ⚠ {riskLevel} Risk
                    </div>
                </div>
                <p className="text-xs text-blue-100/60 leading-relaxed mt-3 font-medium">
                    {mechanism}
                </p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">

                {/* Organ effect cards */}
                {effects.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-blue-300/50 uppercase tracking-widest flex items-center gap-2">
                            <span>🎯</span> Organ Effects
                        </p>
                        {effects
                            .slice()
                            .sort((a, b) => b.intensity - a.intensity)
                            .map(e => {
                                const tc = TYPE_CONFIG[e.type] || TYPE_CONFIG['side-effect'];
                                const { text: iLabel, color: iColor } = intensityLabel(e.intensity);
                                const isSelected = selectedOrgan === e.organ;
                                return (
                                    <div
                                        key={e.organ}
                                        ref={el => { cardRefs.current[e.organ] = el; }}
                                        onClick={() => onOrganSelect(e.organ)}
                                        className={`p-3 rounded-2xl border cursor-pointer transition-all duration-200
                                            ${isSelected
                                                ? 'bg-white/15 border-white/30 shadow-lg shadow-white/5 scale-[1.01]'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">{ORGAN_ICONS[e.organ] || '🫀'}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white text-sm truncate">{e.organ}</p>
                                                <p className="text-[11px] text-blue-100/60 truncate">{e.effect}</p>
                                            </div>
                                            <span className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${tc.bg} ${tc.color} ${tc.border}`}>
                                                {tc.label}
                                            </span>
                                        </div>

                                        {/* Intensity bar */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full bg-gradient-to-r ${intensityGradient(e.intensity)} transition-all duration-700`}
                                                    style={{ width: `${e.intensity * 100}%` }}
                                                />
                                            </div>
                                            <span className={`text-[10px] font-bold ${iColor} w-14 text-right`}>
                                                {iLabel} {(e.intensity * 100).toFixed(0)}%
                                            </span>
                                        </div>

                                        {/* Onset / Duration */}
                                        {(e.onset || e.duration) && (
                                            <div className="flex gap-3 mt-2">
                                                {e.onset && (
                                                    <span className="text-[10px] text-white/40 flex items-center gap-1">
                                                        <span>⏱</span> {e.onset}
                                                    </span>
                                                )}
                                                {e.duration && (
                                                    <span className="text-[10px] text-white/40 flex items-center gap-1">
                                                        <span>⌛</span> {e.duration}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                )}

                {/* Side Effects */}
                {sideEffects.length > 0 && (
                    <InfoList title="Common Side Effects" icon="💊" items={sideEffects} color="yellow" />
                )}

                {/* Long-term */}
                {longTermEffects.length > 0 && (
                    <InfoList title="Long-term Risks" icon="⚠️" items={longTermEffects} color="orange" />
                )}

                {/* Contraindications */}
                {contraindications.length > 0 && (
                    <InfoList title="Contraindications" icon="⛔" items={contraindications} color="red" />
                )}
            </div>
        </div>
    );
};

const InfoList: React.FC<{ title: string; icon: string; items: string[]; color: string }> = ({ title, icon, items, color }) => {
    const colorMap: Record<string, string> = {
        yellow: 'text-yellow-300/60 bg-yellow-500/8 border-yellow-500/20',
        orange: 'text-orange-300/60 bg-orange-500/8 border-orange-500/20',
        red: 'text-red-300/70 bg-red-500/10 border-red-500/25',
    };
    const tagColor: Record<string, string> = {
        yellow: 'text-yellow-200/80 bg-yellow-500/10 border-yellow-500/20',
        orange: 'text-orange-200/80 bg-orange-500/10 border-orange-500/20',
        red: 'text-red-200/80 bg-red-500/10 border-red-500/20',
    };
    return (
        <div className={`p-3 rounded-2xl border ${colorMap[color]}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 opacity-70">
                <span>{icon}</span>{title}
            </p>
            <div className="flex flex-wrap gap-1.5">
                {items.map((item, i) => (
                    <span key={i} className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${tagColor[color]}`}>
                        {item}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default DrugOrganPanel;
