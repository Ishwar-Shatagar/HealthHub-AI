import React, { useState, useRef, useCallback, useEffect } from 'react';
import { analyzeMedicalImage, MedicalFinding, MedicalImagingResult } from '../services/geminiService';
import NearbyDoctors from '../components/NearbyDoctors';

const SCAN_TYPES = ['X-Ray', 'MRI', 'CT Scan'];

/* ─────────────────────────────────────────────
   Animated count-up hook
───────────────────────────────────────────── */
function useCountUp(target: number, duration = 1200, start = false) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!start) return;
        let startTime: number | null = null;
        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            setValue(Math.floor(progress * target));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [target, duration, start]);
    return value;
}

/* ─────────────────────────────────────────────
   Single result card with count-up
───────────────────────────────────────────── */
const ResultCard: React.FC<{ result: MedicalFinding; delay: number; show: boolean }> = ({ result, delay, show }) => {
    const [visible, setVisible] = useState(false);
    const [countStarted, setCountStarted] = useState(false);
    const count = useCountUp(result.confidence, 1000, countStarted);

    useEffect(() => {
        if (!show) return;
        const t1 = setTimeout(() => setVisible(true), delay);
        const t2 = setTimeout(() => setCountStarted(true), delay + 200);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [show, delay]);

    const severityColor =
        result.severity === 'high' ? 'border-red-400/40 bg-red-500/5' :
            result.severity === 'moderate' ? 'border-amber-400/40 bg-amber-500/5' :
                'border-cyan-400/20 bg-cyan-500/5';

    const barColor =
        result.severity === 'high' ? 'bg-red-400' :
            result.severity === 'moderate' ? 'bg-amber-400' :
                'bg-cyan-400';

    const confColor =
        result.severity === 'high' ? 'text-red-400' :
            result.severity === 'moderate' ? 'text-amber-400' :
                'text-cyan-400';

    return (
        <div
            className={`rounded-2xl border p-5 transition-all duration-700 ${severityColor} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{result.icon}</span>
                    <div>
                        <p className="font-semibold text-white tracking-wide">{result.condition}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{result.explanation}</p>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <p className={`text-2xl font-bold ${confColor}`}>{count}%</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Confidence</p>
                </div>
            </div>

            {/* Severity bar */}
            <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden mb-3">
                <div
                    className={`h-full rounded-full transition-all duration-[1500ms] ease-out ${barColor}`}
                    style={{ width: countStarted ? `${result.confidence}%` : '0%' }}
                />
            </div>

            <div className="flex items-start gap-2 text-xs text-slate-300 bg-white/[0.03] rounded-xl p-3 border border-white/5">
                <svg className="w-3.5 h-3.5 mt-0.5 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{result.action}</span>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
type Phase = 'upload' | 'scanning' | 'results' | 'error';

const MedicalImaging: React.FC = () => {
    const [phase, setPhase] = useState<Phase>('upload');
    const [isDragging, setIsDragging] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanMsg, setScanMsg] = useState('Initialising neural analysis...');
    const [actionOpen, setActionOpen] = useState(false);
    const [showDisclaimer, setShowDisclaimer] = useState(false);
    const [selectedType, setSelectedType] = useState('X-Ray');
    const [aiResult, setAiResult] = useState<MedicalImagingResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Convert file to base64
    const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve({ base64, mimeType: file.type });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const processFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) return;
        const url = URL.createObjectURL(file);
        setImageUrl(url);
        setPhase('scanning');
        setScanProgress(0);
        setAiResult(null);
        setErrorMsg('');

        const messages = [
            'Initialising neural analysis...',
            'Segmenting anatomical structures...',
            'Running pathology detection model...',
            'Cross-referencing diagnostic database...',
            'Generating AI report...',
        ];
        let msgIdx = 0;
        setScanMsg(messages[0]);

        // Cycle through messages
        const msgTimer = setInterval(() => {
            msgIdx = Math.min(msgIdx + 1, messages.length - 1);
            setScanMsg(messages[msgIdx]);
        }, 1200);

        // Animated fake progress that pauses at 90% waiting for real API
        let prog = 0;
        scanIntervalRef.current = setInterval(() => {
            prog += Math.random() * 3 + 0.5;
            if (prog >= 90) prog = 90; // Pause at 90 until API responds
            setScanProgress(Math.floor(prog));
        }, 80);

        // Call HealthHub AI Core™ Vision Engine
        fileToBase64(file).then(({ base64, mimeType }) =>
            analyzeMedicalImage(base64, mimeType, selectedType)
        ).then((result) => {
            clearInterval(scanIntervalRef.current!);
            clearInterval(msgTimer);
            setScanProgress(100);
            setScanMsg('Analysis complete.');
            setAiResult(result);
            setTimeout(() => {
                setPhase('results');
                setTimeout(() => setShowDisclaimer(true), 1500);
            }, 500);
        }).catch((err) => {
            clearInterval(scanIntervalRef.current!);
            clearInterval(msgTimer);
            console.error('Medical imaging API error:', err);
            setErrorMsg(err?.message || 'AI analysis failed. Please try again.');
            setPhase('error');
        });
    }, [selectedType]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, [processFile]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const reset = () => {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        setPhase('upload');
        setImageUrl(null);
        setScanProgress(0);
        setActionOpen(false);
        setShowDisclaimer(false);
        setAiResult(null);
        setErrorMsg('');
    };

    return (
        <div className="relative min-h-screen w-full bg-gradient-to-br from-[#050f1f] via-[#071828] to-[#020c18] overflow-hidden">

            {/* ── Hex watermark background ── */}
            <div className="absolute inset-y-0 left-0 w-[55%] z-0 pointer-events-none overflow-hidden"
                style={{ maskImage: 'linear-gradient(to right, rgba(0,0,0,0.08) 0%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0.08) 0%, transparent 100%)' }}>
                <img src="/hex-bg-2.png" alt="" className="w-full h-full object-cover opacity-[0.06] animate-pulse-slower" />
            </div>

            {/* ── Ambient glows ── */}
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-700/5 rounded-full blur-[100px] pointer-events-none" />

            {/* ── Page content ── */}
            <div className="relative z-10 max-w-6xl mx-auto px-4 py-10">

                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1.5 mb-4">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                        <span className="text-xs text-cyan-400 font-semibold tracking-widest uppercase">HealthHub AI Core™ Radiology Engine</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3">
                        AI Medical Imaging{' '}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">Intelligence</span>
                    </h1>
                    <p className="text-slate-400 text-lg max-w-xl mx-auto">
                        Upload X-Ray, MRI, or CT scans for real-time AI-powered diagnostic analysis.
                    </p>
                </div>

                {/* Scan type selector */}
                <div className="flex gap-3 justify-center mb-8">
                    {SCAN_TYPES.map(t => (
                        <button
                            key={t}
                            onClick={() => { if (phase === 'upload') setSelectedType(t); }}
                            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 border ${selectedType === t
                                ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                                }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* Main Card */}
                <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-[float_6s_ease-in-out_infinite]"
                    style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)' }}>

                    {/* Card top bar */}
                    <div className="flex items-center justify-between px-8 py-4 border-b border-white/[0.06] bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-red-500/60" />
                            <div className="w-3 h-3 rounded-full bg-amber-400/60" />
                            <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
                        </div>
                        <span className="text-xs text-slate-500 font-mono tracking-widest uppercase">{selectedType} Diagnostic Module</span>
                        {phase !== 'upload' && (
                            <button onClick={reset}
                                className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                New Scan
                            </button>
                        )}
                        {phase === 'upload' && <div className="w-20" />}
                    </div>

                    <div className="p-8">
                        {/* ═══════════ UPLOAD PHASE ═══════════ */}
                        {phase === 'upload' && (
                            <div
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center py-20 px-8 text-center overflow-hidden group
                                ${isDragging
                                        ? 'border-cyan-400 bg-cyan-500/10 scale-[1.02] shadow-[0_0_40px_rgba(34,211,238,0.2)]'
                                        : 'border-white/15 hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(34,211,238,0.1)]'
                                    }`}
                            >
                                {/* Shimmer sweep */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1500ms] ease-in-out" />

                                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center mb-6 transition-transform duration-300 ${isDragging ? 'scale-110' : 'group-hover:scale-105'}`}>
                                    <svg className="w-9 h-9 text-cyan-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <p className="text-xl font-semibold text-white mb-2">Drop your {selectedType} image here</p>
                                <p className="text-slate-400 text-sm mb-6">or click to browse · PNG, JPG, DICOM supported</p>
                                <div className="px-6 py-2.5 bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white text-sm font-semibold rounded-full border border-cyan-400/30 shadow-lg shadow-cyan-900/30">
                                    Select {selectedType} Image
                                </div>
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                            </div>
                        )}

                        {/* ═══════════ ERROR PHASE ═══════════ */}
                        {phase === 'error' && (
                            <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
                                <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                                    <svg className="w-9 h-9 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-white mb-2">Analysis Failed</p>
                                    <p className="text-slate-400 text-sm max-w-sm">{errorMsg}</p>
                                </div>
                                <button onClick={reset}
                                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white text-sm font-semibold rounded-full border border-cyan-400/30">
                                    Try Again
                                </button>
                            </div>
                        )}

                        {/* ═══════════ SCANNING PHASE ═══════════ */}
                        {phase === 'scanning' && imageUrl && (
                            <div className="grid md:grid-cols-5 gap-8">
                                {/* Image with scanner overlay */}
                                <div className="md:col-span-3 relative rounded-2xl overflow-hidden border border-white/10 bg-black/30 aspect-square md:aspect-auto min-h-[320px]">
                                    <img src={imageUrl} alt="scan" className="w-full h-full object-contain opacity-90 grayscale" />
                                    {/* Grid overlay */}
                                    <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_40px,rgba(34,211,238,0.04)_40px,rgba(34,211,238,0.04)_41px),repeating-linear-gradient(90deg,transparent,transparent_40px,rgba(34,211,238,0.04)_40px,rgba(34,211,238,0.04)_41px)]" />
                                    {/* Scanning beam */}
                                    <div className="absolute left-0 right-0 h-1 pointer-events-none"
                                        style={{ background: 'linear-gradient(180deg, transparent, rgba(34,211,238,0.8), transparent)', animation: 'scan 2.5s linear infinite', top: 0 }} />
                                    {/* Corner reticles */}
                                    {[['top-3 left-3', 'M0,12 L0,0 L12,0'], ['top-3 right-3', 'M12,12 L12,0 L0,0'], ['bottom-3 left-3', 'M0,0 L0,12 L12,12'], ['bottom-3 right-3', 'M12,0 L12,12 L0,12']].map(([pos, d], i) => (
                                        <svg key={i} className={`absolute w-5 h-5 ${pos}`} viewBox="0 0 12 12" fill="none" stroke="#22d3ee" strokeWidth="1.5">
                                            <path d={d} />
                                        </svg>
                                    ))}
                                    <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm border border-cyan-400/30 text-cyan-300 text-[10px] font-mono px-3 py-1 rounded-full flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                                        GEMINI AI ANALYZING
                                    </div>
                                </div>

                                {/* Right status panel */}
                                <div className="md:col-span-2 flex flex-col gap-5">
                                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">AI Engine Status</p>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="relative w-10 h-10 shrink-0">
                                                <svg className="w-10 h-10 -rotate-90 animate-spin" style={{ animationDuration: '2s' }} viewBox="0 0 36 36">
                                                    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(34,211,238,0.15)" strokeWidth="3" />
                                                    <circle cx="18" cy="18" r="15" fill="none" stroke="#22d3ee" strokeWidth="3"
                                                        strokeDasharray={`${scanProgress * 0.942} 94.2`} strokeLinecap="round" />
                                                </svg>
                                                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-cyan-400">{scanProgress}%</span>
                                            </div>
                                            <p className="text-sm text-slate-300 animate-pulse">{scanMsg}</p>
                                        </div>
                                        <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-150 ease-linear"
                                                style={{ width: `${scanProgress}%` }} />
                                        </div>
                                    </div>

                                    {/* Scan meta */}
                                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3">Scan Metadata</p>
                                        {[['Modality', selectedType], ['Model', 'HealthHub AI Core™'], ['Powered by', 'HealthHub Intelligence Labs'], ['Protocol', 'Standard Diagnostic']].map(([k, v]) => (
                                            <div key={k} className="flex justify-between text-sm">
                                                <span className="text-slate-500">{k}</span>
                                                <span className="text-slate-200 font-medium">{v}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Skeleton placeholders */}
                                    <div className="space-y-3">
                                        {[80, 60, 40].map((w, i) => (
                                            <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse shrink-0" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-2 bg-white/10 rounded-full animate-pulse" style={{ width: `${w}%` }} />
                                                    <div className="h-2 bg-white/5 rounded-full animate-pulse w-1/2" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══════════ RESULTS PHASE ═══════════ */}
                        {phase === 'results' && imageUrl && aiResult && (
                            <div className="grid md:grid-cols-5 gap-8">
                                {/* Analysed image */}
                                <div className="md:col-span-2 flex flex-col gap-4">
                                    <div className="relative rounded-2xl overflow-hidden border border-cyan-500/20 bg-black/30 min-h-[280px]">
                                        <img src={imageUrl} alt="scan" className="w-full h-full object-contain grayscale opacity-80" />
                                        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_40px,rgba(34,211,238,0.03)_40px,rgba(34,211,238,0.03)_41px),repeating-linear-gradient(90deg,transparent,transparent_40px,rgba(34,211,238,0.03)_40px,rgba(34,211,238,0.03)_41px)]" />
                                        <div className="absolute top-[30%] left-[40%] w-16 h-12 bg-amber-400/20 rounded-full blur-xl animate-pulse" />
                                        <div className="absolute top-[45%] right-[30%] w-10 h-10 bg-cyan-400/15 rounded-full blur-lg animate-pulse" style={{ animationDelay: '0.5s' }} />
                                        <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur-sm border border-emerald-400/30 text-emerald-300 text-[10px] font-mono px-3 py-2 rounded-xl flex items-center gap-2">
                                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            HealthHub AI Core™ Analysis · {aiResult.findings.length} findings
                                        </div>
                                    </div>

                                    {/* Summary card */}
                                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">Overall Summary</p>
                                        <p className="text-sm text-slate-300 leading-relaxed">{aiResult.overallSummary}</p>
                                    </div>
                                </div>

                                {/* Results panel */}
                                <div className="md:col-span-3 space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-lg font-bold text-white">Diagnostic Findings</h3>
                                        <span className="text-xs text-slate-500 font-mono">{new Date().toLocaleString()}</span>
                                    </div>

                                    {aiResult.findings.map((r, i) => (
                                        <ResultCard key={i} result={r} delay={i * 180} show={phase === 'results'} />
                                    ))}

                                    {/* Recommended Action Plan accordion */}
                                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
                                        <button
                                            onClick={() => setActionOpen(p => !p)}
                                            className="w-full flex items-center justify-between px-5 py-4 text-left"
                                        >
                                            <span className="font-semibold text-blue-200 flex items-center gap-2">
                                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                </svg>
                                                Recommended Action Plan
                                            </span>
                                            <svg className={`w-4 h-4 text-blue-400 transition-transform duration-300 ${actionOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        <div className={`transition-all duration-500 ease-in-out overflow-hidden ${actionOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                            <div className="px-5 pb-5 space-y-4 border-t border-blue-500/10">
                                                <div className="grid grid-cols-2 gap-4 mt-4">
                                                    {[
                                                        { label: 'Urgency Level', value: aiResult.urgencyLevel, color: 'text-amber-400', bar: 'bg-amber-400', pct: aiResult.urgencyLevel.toLowerCase() === 'urgent' ? 90 : aiResult.urgencyLevel.toLowerCase() === 'moderate' ? 60 : 30 },
                                                        { label: 'Follow-up', value: aiResult.followUp, color: 'text-cyan-400', bar: 'bg-cyan-400', pct: 50 },
                                                    ].map(item => (
                                                        <div key={item.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                                                            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">{item.label}</p>
                                                            <p className={`font-bold text-base ${item.color} mb-2`}>{item.value}</p>
                                                            <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                                                                <div className={`h-full rounded-full transition-all duration-1000 ${item.bar}`}
                                                                    style={{ width: actionOpen ? `${item.pct}%` : '0%' }} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <ul className="space-y-2">
                                                    {aiResult.actionPlan.map((step, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                                            <svg className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            {step}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Disclaimer */}
                                    <div className={`transition-all duration-700 ${showDisclaimer ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
                                        <p className="text-[11px] text-slate-600 text-center border-t border-white/[0.05] pt-4">
                                            🔬 AI-assisted analysis powered by HealthHub AI Core™. Not a substitute for professional medical diagnosis. Always consult a qualified radiologist or physician.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <NearbyDoctors searchType="radiology" title="Nearby Radiology Centers & Imaging Clinics" />
            </div>
        </div>
    );
};

export default MedicalImaging;
