import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Brain, Search, Info, Shield, Layers, Camera, FileText, Mic, MicOff } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { analyzeDrugImpact, analyzeDrugSynthesis } from '../services/geminiService';
import { DrugAnalysisResult, HeatmapEffect } from '../types';
import { ICONS } from '../constants';
import DrugHeatmap3D from '../components/DrugHeatmap3D';
import DrugOrganPanel from '../components/DrugOrganPanel';
import HandTrackingOverlay from '../components/HandTrackingOverlay';

// ─── Heatmap color legend ──────────────────────────────────────────────────────
const HeatmapLegend: React.FC = () => (
    <div className="flex items-center gap-3 px-4 py-2 bg-black/30 rounded-xl border border-white/10 backdrop-blur-md">
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Intensity</span>
        <div className="flex items-center h-3 flex-1 rounded-full overflow-hidden">
            <div className="h-full w-full" style={{
                background: 'linear-gradient(to right, #3b82f6, #06b6d4, #22c55e, #eab308, #f97316, #ef4444)'
            }} />
        </div>
        <div className="flex gap-3 text-[10px] font-semibold">
            <span className="text-blue-400">Low</span>
            <span className="text-yellow-400">Mod</span>
            <span className="text-red-400">High</span>
        </div>
    </div>
);

// ─── Quick drug presets ─────────────────────────────────────────────────────────
const DRUG_PRESETS = [
    { name: 'Ibuprofen', icon: '💊' },
    { name: 'Metformin', icon: '🩸' },
    { name: 'Aspirin', icon: '❤️' },
    { name: 'Paracetamol', icon: '🌡️' },
    { name: 'Alcohol', icon: '🍺' },
    { name: 'Caffeine', icon: '☕' },
];

const ROUTES = ['Oral', 'Intravenous (IV)', 'Intramuscular (IM)', 'Topical', 'Inhalation', 'Sublingual'];

// ─── Main component ─────────────────────────────────────────────────────────────
export const DrugImpactVisualizer = () => {
    const { navigateTo } = useAppContext();

    // Inputs
    const [analysisMode, setAnalysisMode] = useState<'text' | 'image'>('text');
    const [drugName, setDrugName] = useState('Ibuprofen');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const [dosage, setDosage] = useState(400);      // mg
    const [route, setRoute] = useState('Oral');
    const [age, setAge] = useState<number | ''>('');
    const [weight, setWeight] = useState<number | ''>('');
    const [genomicProfile, setGenomicProfile] = useState('Standard (Normal Metabolizer)');
    const [timePhase, setTimePhase] = useState<'0 min' | 'onset' | 'peak' | 'mid duration' | 'end duration'>('peak');

    // State
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<DrugAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);

    // Comparison mode
    const [compareMode, setCompareMode] = useState(false);
    const [drugName2, setDrugName2] = useState('');
    const [result2, setResult2] = useState<DrugAnalysisResult | null>(null);
    const [isLoading2, setIsLoading2] = useState(false);

    // 3D View settings
    const [viewMode, setViewMode] = useState<'BODY' | 'SKELETON'>('BODY');

    // Voice Command State
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    // Hand Tracking State
    const [isHandTrackingActive, setIsHandTrackingActive] = useState(false);
    const [handRotationDelta, setHandRotationDelta] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [handDragDelta, setHandDragDelta] = useState<{ x: number, y: number } | undefined>(undefined);
    const [handZoomDelta, setHandZoomDelta] = useState<number>(0);
    const [cameraResetFlag, setCameraResetFlag] = useState(0);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Web Speech API (Voice Commands) ─────────────
    useEffect(() => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (e: any) => {
            console.error('Speech recognition error', e);
            setIsListening(false);
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            console.log("Voice Command:", transcript);

            if (transcript.includes('analyze') || transcript.includes('check')) {
                const words = transcript.split(' ');
                const target = words[words.length - 1];
                if (target && target.length > 2) {
                    setDrugName(target);
                    setTimeout(() => {
                        const analyzeBtn = document.getElementById('run-analysis-btn');
                        if (analyzeBtn) analyzeBtn.click();
                    }, 500);
                }
            }

            // Physical Inputs
            else if (transcript.includes('dosage') || transcript.includes('dose')) {
                const match = transcript.match(/\d+/);
                if (match) setDosage(Number(match[0]));
            }
            else if (transcript.includes('age')) {
                const match = transcript.match(/\d+/);
                if (match) setAge(Number(match[0]));
            }
            else if (transcript.includes('weight')) {
                const match = transcript.match(/\d+/);
                if (match) setWeight(Number(match[0]));
            }

            // Route of Administration
            else if (transcript.includes('oral') || transcript.includes('by mouth')) setRoute('Oral');
            else if (transcript.includes('iv') || transcript.includes('intravenous')) setRoute('Intravenous');
            else if (transcript.includes('im') || transcript.includes('intramuscular')) setRoute('Intramuscular');
            else if (transcript.includes('subcutaneous')) setRoute('Subcutaneous');
            else if (transcript.includes('topical')) setRoute('Topical');
            else if (transcript.includes('inhalation')) setRoute('Inhalation');

            // Metabolic Profile
            else if (transcript.includes('ultra rapid') || transcript.includes('ultrarapid') || transcript.includes('ultra-rapid')) setGenomicProfile('Ultra-Rapid Metabolizer');
            else if (transcript.includes('extensive') || transcript.includes('normal')) setGenomicProfile('Standard (Normal Metabolizer)');
            else if (transcript.includes('intermediate')) setGenomicProfile('Intermediate Metabolizer');
            else if (transcript.includes('poor metabolizer') || transcript.includes('slow metabolizer')) setGenomicProfile('Poor Metabolizer');

            // View Controls
            else if (transcript.includes('show liver') || transcript.includes('liver')) setSelectedOrgan('Liver');
            else if (transcript.includes('show heart') || transcript.includes('heart')) setSelectedOrgan('Heart');
            else if (transcript.includes('show brain') || transcript.includes('brain')) setSelectedOrgan('Brain');
            else if (transcript.includes('skeleton') || transcript.includes('bones')) setViewMode('SKELETON');
            else if (transcript.includes('body') || transcript.includes('flesh')) setViewMode('BODY');

        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const toggleVoice = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current?.start();
        }
    };

    // ─── Derive HeatmapEffect[] from result ─────────────
    const uniqueEffects = useMemo((): HeatmapEffect[] => {
        if (!result) return [];
        let effects: HeatmapEffect[] = [];
        if (Array.isArray(result.heatmap_effects)) effects = result.heatmap_effects;
        else if (Array.isArray(result.effects)) effects = result.effects as unknown as HeatmapEffect[];

        if (result.time_based_intensity && result.time_based_intensity[timePhase] !== undefined) {
            const multiplier = result.time_based_intensity[timePhase];
            return effects.map(e => ({ ...e, intensity: e.intensity * multiplier }));
        }
        return effects;
    }, [result, timePhase]);

    const uniqueEffects2 = useMemo((): HeatmapEffect[] => {
        if (!result2) return [];
        let effects: HeatmapEffect[] = [];
        if (Array.isArray(result2.heatmap_effects)) effects = result2.heatmap_effects;
        else if (Array.isArray(result2.effects)) effects = result2.effects as unknown as HeatmapEffect[];

        if (result2.time_based_intensity && result2.time_based_intensity[timePhase] !== undefined) {
            const multiplier = result2.time_based_intensity[timePhase];
            return effects.map(e => ({ ...e, intensity: e.intensity * multiplier }));
        }
        return effects;
    }, [result2, timePhase]);

    const computedRiskLevel = useMemo((): 'low' | 'moderate' | 'high' | 'severe' => {
        if (!result) return 'moderate';
        if (result.system_wide_risk_score !== undefined) {
            if (result.system_wide_risk_score < 0.3) return 'low';
            if (result.system_wide_risk_score < 0.6) return 'moderate';
            if (result.system_wide_risk_score < 0.85) return 'high';
            return 'severe';
        }
        const r = result.risk_level?.toLowerCase();
        if (r === 'low' || r === 'moderate' || r === 'high' || r === 'severe') return r;
        return 'moderate';
    }, [result]);

    // ─── Analysis ─────────────────────────────────────────────────────────────
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyze = async () => {
        if (analysisMode === 'text') {
            if (!drugName.trim()) return;
            setIsLoading(true);
            setResult(null);
            setError(null);
            setSelectedOrgan(null);
            try {
                const res = await analyzeDrugImpact(
                    drugName,
                    `${dosage}mg`,
                    age || undefined,
                    route,
                    weight || undefined,
                    genomicProfile
                );
                if (res) {
                    setResult(res);
                }
            } catch (err) {
                console.error("Analysis failed", err);
                setError('Analysis failed. Please check your network and try again.');
            } finally {
                setIsLoading(false);
            }
        } else {
            if (!imagePreview) return;
            setIsLoading(true);
            setResult(null);
            setError(null);
            setSelectedOrgan(null);
            try {
                const res = await analyzeDrugSynthesis(
                    imagePreview,
                    `${dosage}mg`,
                    age || undefined,
                    route,
                    weight || undefined
                );
                if (res) {
                    setResult(res);
                    // Update drugname so the UI header matches the inferred drug
                    setDrugName(res.drug_name || 'Inferred Structure');
                }
            } catch (err) {
                console.error("Image Analysis failed", err);
                setError('Image analysis failed. Please check your network and try again.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleAnalyze2 = async () => {
        if (!drugName2.trim()) return;
        setIsLoading2(true);
        setResult2(null);
        try {
            const data = await analyzeDrugImpact(
                drugName2,
                `${dosage}mg`,
                age || undefined,
                route,
                weight || undefined,
                genomicProfile
            );
            setResult2(data);
        } catch (err) {
            console.error('Drug analysis failed:', err);
            // No specific error state for second drug, just log
        } finally {
            setIsLoading2(false);
        }
    }

    // Dosage slider re-triggers analysis with debounce
    const handleDosageChange = (v: number) => {
        setDosage(v);
        if (!result) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => handleAnalyze(), 800);
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white font-sans overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]
                from-slate-900 via-gray-950 to-black">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                <div className="absolute top-0 left-0 w-96 h-96 bg-rose-600/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] translate-x-1/2 -translate-y-1/2" />
            </div>

            <div className="relative z-10 flex flex-col h-full">
                {/* ── Top Bar ──────────────────────────────────────────────── */}
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-4
                    border-b border-white/10 bg-black/20 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigateTo('DASHBOARD')}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10
                                transition-all group">
                            <span className="group-hover:-translate-x-1 block transition-transform text-white">
                                {ICONS.arrowLeft}
                            </span>
                        </button>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">
                                Drug{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-purple-400">
                                    Impact Visualizer
                                </span>
                            </h1>
                            <p className="text-xs text-blue-100/50">AI-powered 3D pharmacological heatmap</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 no-print">
                        <HeatmapLegend />
                        <button
                            onClick={() => { setCompareMode(v => !v); setResult2(null); setDrugName2(''); }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all
                                ${compareMode
                                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}`}>
                            {compareMode ? '✕ Exit Compare' : '⚖ Compare Drugs'}
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition-all bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 flex items-center gap-2">
                            <span>📄</span> Export PDF
                        </button>
                    </div>
                </div>

                {/* ── Main 3-Column Layout ─────────────────────────────────── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* LEFT PANEL — Inputs */}
                    <div className="w-72 flex-shrink-0 flex flex-col border-r border-white/10
                        bg-black/20 backdrop-blur-sm overflow-y-auto no-print">
                        <div className="p-5 space-y-5">

                            {/* Mode Toggle */}
                            <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                                <button
                                    onClick={() => setAnalysisMode('text')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2
                                        ${analysisMode === 'text' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                                >
                                    <FileText size={14} /> Text Search
                                </button>
                                <button
                                    onClick={() => setAnalysisMode('image')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2
                                        ${analysisMode === 'image' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                                >
                                    <Camera size={14} /> Image Scan
                                </button>
                            </div>

                            {/* Input Area */}
                            {analysisMode === 'text' ? (
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-200/50 uppercase tracking-widest mb-2">
                                        Drug Name
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={drugName}
                                            onChange={e => setDrugName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                                            placeholder="e.g. Ibuprofen"
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3
                                                text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50
                                                placeholder:text-white/20 transition-all text-sm"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-200/50 uppercase tracking-widest mb-2">
                                        Chemical Structure Image
                                    </label>
                                    <div className="relative border-2 border-dashed border-white/20 rounded-2xl bg-black/40 hover:bg-white/5 transition-colors group">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                        <div className="p-6 flex flex-col items-center justify-center text-center">
                                            {imagePreview ? (
                                                <img src={imagePreview} alt="Chemical Structure" className="h-24 object-contain rounded-lg mb-2 opacity-80 mix-blend-screen" />
                                            ) : (
                                                <Camera size={32} className="text-white/20 mb-3 group-hover:text-rose-400 group-hover:scale-110 transition-all" />
                                            )}
                                            <p className="text-xs font-bold text-white/60">
                                                {imageFile ? imageFile.name : 'Click or drop image here'}
                                            </p>
                                            <p className="text-[10px] text-white/30 mt-1">PNG, JPG, limit 5MB</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Quick presets */}
                            {analysisMode === 'text' && (
                                <div>
                                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Quick Select</p>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {DRUG_PRESETS.map(p => (
                                            <button
                                                key={p.name}
                                                onClick={() => { setDrugName(p.name); }}
                                                className={`flex flex-col items-center py-2 px-1 rounded-xl text-[10px] font-bold
                                                    border transition-all duration-300 hover:scale-[1.03] active:scale-95 relative overflow-hidden group
                                                    ${drugName === p.name
                                                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                                                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/20'}`}>
                                                <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <span className="text-base mb-0.5 relative z-10">{p.icon}</span>
                                                <span className="relative z-10">{p.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Dosage slider */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-bold text-blue-200/50 uppercase tracking-widest">
                                        Dosage
                                    </label>
                                    <span className="text-sm font-black text-white">{dosage} mg</span>
                                </div>
                                <input
                                    type="range" min={1} max={2000} step={1}
                                    value={dosage}
                                    onChange={e => handleDosageChange(Number(e.target.value))}
                                    className="w-full accent-rose-500 cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-white/30 mt-1">
                                    <span>1 mg</span><span>2000 mg</span>
                                </div>
                            </div>

                            {/* Route & Genomic Profile */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-200/50 uppercase tracking-widest mb-1.5">
                                        Route of Administration
                                    </label>
                                    <select
                                        value={route}
                                        onChange={e => setRoute(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-2.5
                                            text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50
                                            [&>option]:text-gray-900 transition-all">
                                        {ROUTES.map(r => <option key={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div className="p-3 bg-purple-900/10 border border-purple-500/20 rounded-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all" />
                                    <label className="block text-[10px] font-bold text-purple-300/80 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                        🧬 Genomic Profile
                                        <span className="text-[8px] bg-purple-500/30 px-1.5 rounded-sm">NEW</span>
                                    </label>
                                    <select
                                        value={genomicProfile}
                                        onChange={e => setGenomicProfile(e.target.value)}
                                        className="w-full bg-black/40 border border-purple-500/30 rounded-xl px-3 py-2
                                            text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/50
                                            [&>option]:text-gray-900 transition-all shadow-[0_0_10px_rgba(168,85,247,0.1)]">
                                        <option>Standard (Normal Metabolizer)</option>
                                        <option>CYP450 Poor Metabolizer</option>
                                        <option>CYP450 Ultra-Rapid Metabolizer</option>
                                        <option>Renal Impairment Marker</option>
                                    </select>
                                </div>
                            </div>

                            {/* Patient factors */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-200/50 uppercase tracking-widest mb-1.5">
                                        Age
                                    </label>
                                    <input
                                        type="number" min={0} max={120}
                                        value={age}
                                        onChange={e => setAge(e.target.value ? parseInt(e.target.value) : '')}
                                        placeholder="yrs"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5
                                            text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50
                                            placeholder:text-white/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-200/50 uppercase tracking-widest mb-1.5">
                                        Weight
                                    </label>
                                    <input
                                        type="number" min={0} max={300}
                                        value={weight}
                                        onChange={e => setWeight(e.target.value ? parseInt(e.target.value) : '')}
                                        placeholder="kg"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5
                                            text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50
                                            placeholder:text-white/20"
                                    />
                                </div>
                            </div>

                            {/* Iron-Man Controls */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => setIsHandTrackingActive(v => !v)}
                                    className={`px-3 py-2.5 rounded-xl text-[10px] font-bold transition-all border flex flex-col items-center justify-center gap-1.5
                                        ${isHandTrackingActive
                                            ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-[0_0_15px_rgba(14,165,233,0.3)] animate-pulse'
                                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'}`}>
                                    <Camera size={16} />
                                    {isHandTrackingActive ? 'Tracking Hands' : 'Hand Gestures'}
                                </button>
                                <button
                                    onClick={toggleVoice}
                                    className={`px-3 py-2.5 rounded-xl text-[10px] font-bold transition-all border flex flex-col items-center justify-center gap-1.5
                                        ${isListening
                                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse'
                                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'}`}>
                                    {isListening ? <Mic size={16} /> : <MicOff size={16} />}
                                    {isListening ? 'Listening...' : 'Voice Command'}
                                </button>
                            </div>

                            {/* Analyze button */}
                            <button
                                id="run-analysis-btn"
                                onClick={handleAnalyze}
                                disabled={isLoading || (analysisMode === 'text' && !drugName.trim()) || (analysisMode === 'image' && !imagePreview)}
                                className="w-full py-3.5 rounded-2xl font-black text-sm text-white
                                    bg-gradient-to-r from-rose-500 to-orange-500
                                    hover:from-rose-400 hover:to-orange-400
                                    shadow-lg shadow-rose-500/25 transition-all
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2 animate-pulse">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Analyzing {(analysisMode === 'text' ? 'Database' : 'Image')}...
                                    </span>
                                ) : (
                                    <>
                                        <Search size={18} />
                                        Run Full Analysis
                                    </>
                                )}
                            </button>

                            {error && (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                                    {error}
                                </div>
                            )}

                            {/* Compare drug 2 input */}
                            {compareMode && (
                                <div className="pt-3 border-t border-white/10 space-y-3">
                                    <p className="text-[10px] font-bold text-purple-300/60 uppercase tracking-widest">Compare Drug 2</p>
                                    <input
                                        type="text"
                                        value={drugName2}
                                        onChange={e => setDrugName2(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAnalyze2()}
                                        placeholder="e.g. Aspirin"
                                        className="w-full bg-black/40 border border-purple-500/30 rounded-2xl px-4 py-3
                                            text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50
                                            placeholder:text-white/20 text-sm"
                                    />
                                    <button
                                        onClick={() => handleAnalyze2()}
                                        disabled={isLoading2 || !drugName2.trim()}
                                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600
                                            hover:from-purple-500 hover:to-blue-500
                                            disabled:opacity-40 disabled:cursor-not-allowed
                                            rounded-2xl font-black text-white shadow-lg
                                            transition-all active:scale-95 text-sm">
                                        {isLoading2 ? '⏳ Analyzing...' : '⚖ Compare'}
                                    </button>
                                </div>
                            )}

                        </div>
                    </div>

                    {/* CENTER — 3D Viewer(s) */}
                    <div className={`flex-1 flex flex-col ${compareMode ? 'divide-x divide-white/10' : ''} overflow-hidden relative`}>

                        {/* Top controls for 3D View */}
                        <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-3 no-print">
                            <div className="flex bg-black/40 rounded-xl p-1 border border-white/10 backdrop-blur-md">
                                <button
                                    onClick={() => setViewMode('BODY')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                                        ${viewMode === 'BODY'
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                            : 'text-white/50 hover:text-white/80'}`}>
                                    🧍 Body
                                </button>
                                <button
                                    onClick={() => setViewMode('SKELETON')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                                        ${viewMode === 'SKELETON'
                                            ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                                            : 'text-white/50 hover:text-white/80'}`}>
                                    🦴 Skeleton
                                </button>
                            </div>

                            {/* Temporal Scrubbing Control */}
                            {result && result.time_based_intensity && (
                                <div className="bg-black/60 p-3 rounded-2xl border border-sky-500/20 backdrop-blur-md flex flex-col shadow-lg shadow-sky-500/10">
                                    <label className="text-[10px] font-bold text-sky-300/80 uppercase tracking-widest mb-2 flex flex-col items-end">
                                        <span className="flex items-center gap-1">⌚ Temporal Scrubbing <span className="text-[8px] bg-sky-500/30 px-1 py-0.5 rounded-sm">4D</span></span>
                                        <span className="text-white text-xs mt-0.5 font-black">{timePhase.toUpperCase()}</span>
                                    </label>
                                    <input
                                        type="range" min={0} max={4} step={1}
                                        value={['0 min', 'onset', 'peak', 'mid duration', 'end duration'].indexOf(timePhase)}
                                        onChange={e => {
                                            const phases = ['0 min', 'onset', 'peak', 'mid duration', 'end duration'] as const;
                                            setTimePhase(phases[Number(e.target.value)]);
                                        }}
                                        className="w-40 accent-sky-500 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[9px] text-white/40 mt-1 font-mono">
                                        <span>T+0</span>
                                        <span>PEAK</span>
                                        <span>END</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Primary drug view */}
                            <div className={`${compareMode ? 'flex-1' : 'flex-1'} relative`}>
                                {compareMode && result && (
                                    <div className="absolute top-3 left-3 z-20 px-3 py-1 bg-rose-500/20 border border-rose-500/30
                                    rounded-xl text-xs font-bold text-rose-300">
                                        {result.drug_name}
                                    </div>
                                )}
                                <DrugHeatmap3D
                                    effects={uniqueEffects}
                                    selectedOrgan={selectedOrgan}
                                    isGlassMode={false}
                                    showBody={viewMode === 'BODY'}
                                    showSkeleton={viewMode === 'SKELETON'}
                                    onOrganSelect={setSelectedOrgan}
                                    isAnalyzing={isLoading}
                                    handRotationDelta={handRotationDelta}
                                    handZoomDelta={handZoomDelta}
                                    handDragDelta={handDragDelta}
                                    resetCameraFlag={cameraResetFlag}
                                />
                            </div>

                            {/* Compare view */}
                            {compareMode && (
                                <div className="flex-1 relative">
                                    {result2 && (
                                        <div className="absolute top-3 left-3 z-20 px-3 py-1 bg-purple-500/20 border border-purple-500/30
                                        rounded-xl text-xs font-bold text-purple-300">
                                            {result2.drug_name}
                                        </div>
                                    )}
                                    <DrugHeatmap3D
                                        effects={uniqueEffects2}
                                        selectedOrgan={selectedOrgan}
                                        isGlassMode={false}
                                        showBody={viewMode === 'BODY'}
                                        showSkeleton={viewMode === 'SKELETON'}
                                        onOrganSelect={setSelectedOrgan}
                                        isAnalyzing={isLoading2}
                                        handRotationDelta={handRotationDelta}
                                        handZoomDelta={handZoomDelta}
                                        handDragDelta={handDragDelta}
                                        resetCameraFlag={cameraResetFlag}
                                    />
                                </div>
                            )}

                            <HandTrackingOverlay
                                isActive={isHandTrackingActive}
                                onRotate={(x, y) => setHandRotationDelta({ x, y })}
                                onZoom={(delta) => setHandZoomDelta(delta)}
                                onResetView={() => {
                                    setHandRotationDelta({ x: 0, y: 0 });
                                    setHandDragDelta(undefined);
                                    setHandZoomDelta(0);
                                    setCameraResetFlag(v => v + 1);
                                }}
                                onToggleView={() => setViewMode(v => v === 'BODY' ? 'SKELETON' : 'BODY')}
                            />
                        </div>
                    </div>

                    {/* RIGHT PANEL — Effect Details */}
                    <div className="w-80 flex-shrink-0 border-l border-white/10 bg-black/20 backdrop-blur-sm overflow-hidden flex flex-col">
                        {result ? (
                            <>
                                <DrugOrganPanel
                                    effects={uniqueEffects}
                                    mechanism={result.mechanism || 'Mechanism details not available.'}
                                    shortTermEffects={Array.isArray(result.short_term_effects) ? result.short_term_effects : []}
                                    sideEffects={Array.isArray(result.side_effects) ? result.side_effects : []}
                                    contraindications={Array.isArray(result.contraindications) ? result.contraindications : []}
                                    longTermEffects={Array.isArray(result.long_term_effects) ? result.long_term_effects : []}
                                    riskLevel={computedRiskLevel}
                                    doseDependencyFactor={result.dose_dependency_factor}
                                    drugName={result.drug_name || drugName}
                                    category={result.category || 'Medication'}
                                    pharmacokinetics={result.pharmacokinetics}
                                    pharmacodynamics={result.pharmacodynamics}
                                    interactionRiskFlag={result.interaction_risk_flag}
                                    selectedOrgan={selectedOrgan}
                                    onOrganSelect={setSelectedOrgan}
                                />

                                {/* Genomic Warnings Rendering */}
                                {result.genomic_warnings && result.genomic_warnings.length > 0 && (
                                    <div className="absolute bottom-4 left-4 right-4 bg-red-900/60 border border-red-500/40 p-4 rounded-2xl shadow-[0_10px_30px_rgba(239,68,68,0.3)] backdrop-blur-xl animate-fade-in-up">
                                        <h4 className="text-xs font-black text-red-300 uppercase tracking-widest flex items-center gap-2 mb-2">
                                            <span>🧬</span> Genomic Interaction Warning
                                        </h4>
                                        <ul className="space-y-1">
                                            {result.genomic_warnings.map((w, idx) => (
                                                <li key={idx} className="text-sm font-medium text-white/90 leading-snug">
                                                    {w}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10
                                            flex items-center justify-center mb-5 text-4xl">
                                    💊
                                </div>
                                <h3 className="text-lg font-bold text-white/50 mb-2">Ready for Analysis</h3>
                                <p className="text-sm text-white/25 leading-relaxed">
                                    Enter a drug name and click <span className="text-rose-400 font-bold">Run Analysis</span> to see a 3D heatmap of drug effects on the human body.
                                </p>

                                <div className="mt-6 w-full space-y-2">
                                    {['Highlights affected organs', 'Color-coded by intensity', 'Click organ for details', 'Export to PDF report'].map((tip, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs text-white/30 bg-white/5
                                                    rounded-xl px-3 py-2 border border-white/5">
                                            <span className="text-green-400">✓</span> {tip}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Immersive Scan animation while analyzing globally */}
            {
                (isLoading || isLoading2) && (
                    <div className="fixed inset-0 z-[150] pointer-events-none overflow-hidden flex flex-col items-center justify-center">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-500" />

                        {/* Scanner graphic */}
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="relative w-64 h-64 mb-8">
                                {/* Hexagon grid background */}
                                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxwYXRoIGQ9Ik0wIDEwbTEwLTEwbDEwIDEwbS0xMCAxMGwxMC0xMCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIGZpbGw9Im5vbmUiLz4KPC9zdmc+')] opacity-50 [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)]" />

                                {/* Spinner rings */}
                                <div className="absolute inset-0 border-[3px] border-t-rose-500 border-r-rose-500/30 border-b-rose-500/10 border-l-rose-500/10 rounded-full animate-[spin_2s_linear_infinite]" />
                                <div className="absolute inset-4 border-[2px] border-t-purple-500/10 border-r-purple-500/10 border-b-purple-500 border-l-purple-500/30 rounded-full animate-[spin_3s_linear_infinite_reverse]" />

                                {/* Center symbol */}
                                <div className="absolute inset-0 flex items-center justify-center text-5xl">
                                    💊
                                </div>

                                {/* Scanning laser line mapping over the circle */}
                                <div className="absolute left-0 w-full h-[2px] bg-rose-400 shadow-[0_0_15px_#f43f5e] animate-scan-bounce" />
                            </div>

                            <div className="bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl px-8 py-4 text-center">
                                <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-purple-400 mb-1">
                                    Scanning Pharmacology Database
                                </h2>
                                <div className="flex items-center justify-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <p className="mt-2 text-xs font-mono text-blue-200/50 uppercase tracking-widest">
                                    Cross-referencing {isLoading2 ? drugName2 : drugName}
                                </p>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Global scan animation & print styles */}
            <style>{`
                @keyframes scan-bounce {
                    0% { top: 10%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 90%; opacity: 0; }
                }
                .animate-scan-bounce { animation: scan-bounce 2s ease-in-out infinite alternate; }
                
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .fixed.inset-0.z-\\[100\\] {
                        position: relative !important;
                        background: white !important;
                        color: black !important;
                        overflow: visible !important;
                    }
                    .fixed.inset-0.z-\\[100\\] * {
                        visibility: visible;
                    }
                    /* Ensure 3D canvas and right panel show up perfectly */
                    .flex-1 {
                        border: none !important;
                        background: transparent !important;
                    }
                    .text-white { color: black !important; }
                    .text-white\\/50, .text-blue-100\\/60 { color: #4b5563 !important; }
                    .bg-black\\/20, .bg-white\\/5 { background: #f3f4f6 !important; border-color: #e5e7eb !important; }
                    .text-transparent { background: none !important; -webkit-text-fill-color: black !important; color: black !important; }
                    
                    /* Expand cards */
                    .overflow-y-auto { overflow: visible !important; height: auto !important; }
                    
                    /* Hide backgrounds */
                     .absolute.inset-0.z-0 { display: none !important; }
                }
            `}</style>
        </div >
    );
};

export default DrugImpactVisualizer;
