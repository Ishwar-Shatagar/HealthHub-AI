import React, { useState, useRef, useCallback } from 'react';
import NearbyDoctors from '../components/NearbyDoctors';

// UI SVG Icons
const Icons = {
    kidney: <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>,
    upload: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
    location: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    download: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    warning: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
};

type AnalysisPhase = 'upload' | 'results' | 'error';
interface KidneyAnalysisResponse {
    summary: string;
    issues: { condition: string; severity: 'low' | 'moderate' | 'high' }[];
    causes: { lifestyle?: string[]; medical?: string[] };
    precautions: string[];
    consult_doctor?: string;
}

const KidneyDiseaseAnalyzer: React.FC = () => {
    const [phase, setPhase] = useState<AnalysisPhase>('upload');
    const [isDragging, setIsDragging] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [result, setResult] = useState<KidneyAnalysisResponse | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        addFiles(selectedFiles);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        addFiles(droppedFiles);
    }, []);

    const addFiles = (newFiles: File[]) => {
        const validFiles = newFiles.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
        if (validFiles.length + files.length > 5) {
            alert('You can only upload up to 5 files at a time.');
            return;
        }

        const oversized = validFiles.find(f => f.size > 10 * 1024 * 1024);
        if (oversized) {
            alert('File size exceeds 10MB limit.');
            return;
        }

        setFiles(prev => [...prev, ...validFiles]);
        const urls = validFiles.map(f => URL.createObjectURL(f));
        setPreviewUrls(prev => [...prev, ...urls]);
    };

    const removeFile = (index: number) => {
        const newFiles = [...files];
        const newUrls = [...previewUrls];
        const removedUrl = newUrls[index];
        URL.revokeObjectURL(removedUrl);

        newFiles.splice(index, 1);
        newUrls.splice(index, 1);
        setFiles(newFiles);
        setPreviewUrls(newUrls);
    };

    const analyzeFiles = async () => {
        if (files.length === 0) return;
        setIsAnalyzing(true);
        setErrorMsg('');

        try {
            const formData = new FormData();
            files.forEach(f => formData.append('images', f));

            const response = await fetch('http://localhost:5000/api/kidney-analysis', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.details || 'Analysis failed');
            }

            setResult(data);
            setPhase('results');
        } catch (err: any) {
            console.error(err);
            setErrorMsg(err.message || 'An error occurred during analysis.');
            setPhase('error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getSeverityDetails = (severity: string) => {
        switch (severity.toLowerCase()) {
            case 'high': return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
            case 'moderate': return { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
            default: return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
        }
    };



    return (
        <div className="relative min-h-[calc(100vh-80px)] w-full overflow-y-auto bg-gradient-to-br from-[#020b18] via-[#051428] to-[#020b18] p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-8 pb-20">
                {/* Header Section */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                        <span className="text-xs text-blue-300 font-semibold tracking-widest uppercase">HealthHub Kidney Engine</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
                        Kidney Disease <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Detection</span>
                    </h1>
                    <p className="text-slate-400 text-sm md:text-lg max-w-2xl mx-auto">
                        Upload CT, MRI, Ultrasound scans, or lab reports. Our AI analyzes the images to detect stones, cysts, tumors, and other conditions accurately.
                    </p>
                </div>

                {/* Main Content Area */}
                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-6 md:p-10 relative overflow-hidden">
                    {/* Background glow internal */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

                    {/* PHASE: UPLOAD */}
                    {phase === 'upload' && (
                        <div className="space-y-6">
                            <div
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => previewUrls.length === 0 && fileInputRef.current?.click()}
                                className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center py-16 px-6 text-center group
                                    ${isDragging
                                        ? 'border-blue-400 bg-blue-500/10 scale-[1.01]'
                                        : 'border-white/20 hover:border-blue-500/50 hover:bg-white/5'
                                    } ${previewUrls.length === 0 ? 'cursor-pointer' : ''}`}
                            >
                                {previewUrls.length === 0 ? (
                                    <>
                                        <div className="p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full mb-4 group-hover:scale-110 transition-transform text-blue-400">
                                            {Icons.upload}
                                        </div>
                                        <p className="text-lg font-semibold text-white mb-2">Drag & Drop scans or reports here</p>
                                        <p className="text-slate-400 text-sm mb-6 max-w-sm">Supported formats: JPG, PNG, PDF (1 to 5 files, 10MB each)</p>
                                        <button className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-full shadow-lg shadow-blue-500/20 border border-blue-400/30">
                                            Browse Files
                                        </button>
                                    </>
                                ) : (
                                    <div className="w-full" onClick={e => e.stopPropagation()}>
                                        <div className="flex justify-between items-center mb-6 px-4">
                                            <h4 className="text-sm font-semibold text-slate-300">Selected Files ({previewUrls.length}/5)</h4>
                                            {previewUrls.length < 5 && (
                                                <button onClick={() => fileInputRef.current?.click()} className="text-xs px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10 flex items-center gap-2">
                                                    + Add More
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-4 w-full">
                                            {previewUrls.map((url, idx) => (
                                                <div key={idx} className="relative aspect-square rounded-xl border border-white/10 overflow-hidden group/item bg-black/40 shadow-inner">
                                                    {files[idx].type === 'application/pdf' ? (
                                                        <div className="w-full h-full bg-white/5 flex flex-col items-center justify-center text-xs text-slate-300 font-semibold gap-2">
                                                            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                            PDF
                                                        </div>
                                                    ) : (
                                                        <img src={url} alt="preview" className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-500" />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center">
                                                        <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="bg-red-500/90 hover:bg-red-600 p-2 rounded-full text-white shadow-lg transform scale-0 group-hover/item:scale-100 transition-all duration-300">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                            </div>

                            {previewUrls.length > 0 && (
                                <div className="flex justify-end pt-4 animate-fade-in-up">
                                    <button
                                        onClick={analyzeFiles}
                                        disabled={isAnalyzing}
                                        className={`px-8 py-3.5 rounded-xl font-bold shadow-lg border flex items-center justify-center gap-3 transition-all min-w-[280px]
                                            ${isAnalyzing
                                                ? 'bg-blue-600/50 text-white/80 border-blue-400/10 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-blue-400/30 hover:-translate-y-0.5 hover:shadow-cyan-500/20'}`}
                                    >
                                        {isAnalyzing ? (
                                            <>
                                                <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                <span>AI is analyzing scans...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Analyze Kidney Condition</span>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PHASE: ERROR */}
                    {phase === 'error' && (
                        <div className="py-16 text-center space-y-4">
                            <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-2">
                                {Icons.warning}
                            </div>
                            <h3 className="text-xl font-bold text-white">Analysis Failed</h3>
                            <p className="text-slate-400">{errorMsg}</p>
                            <button onClick={() => setPhase('upload')} className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10">Try Again</button>
                        </div>
                    )}

                    {/* PHASE: RESULTS */}
                    {phase === 'results' && result && (
                        <div id="pdf-report-content" className="space-y-8 animate-fade-in-up">
                            {/* Summary Header */}
                            <div className="bg-gradient-to-br from-blue-900/40 to-cyan-900/20 border border-blue-500/20 rounded-2xl p-6">
                                <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    <span>🩺</span>
                                    Analysis Summary
                                </h2>
                                <p className="text-blue-100/80 leading-relaxed text-sm">{result.summary}</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Issues */}
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                                    <h3 className="text-md font-bold text-white flex items-center gap-2 mb-4">
                                        <span>📊</span>
                                        Detected Issues
                                    </h3>
                                    {result.issues.map((issue, i) => {
                                        const sevStyle = getSeverityDetails(issue.severity);
                                        return (
                                            <div key={i} className={`flex justify-between items-center p-3 rounded-xl border ${sevStyle.bg} ${sevStyle.border}`}>
                                                <span className="text-slate-200 font-medium text-sm">{issue.condition}</span>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-black/40 flex items-center gap-1.5 ${sevStyle.color}`}>
                                                    <span>⚠</span> {issue.severity} Risk
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {result.issues.length === 0 && (
                                        <p className="text-sm text-slate-400 text-center py-4">No significant issues detected.</p>
                                    )}
                                </div>

                                {/* Causes */}
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                    <h3 className="text-md font-bold text-white flex items-center gap-2 mb-4">
                                        <span>🧬</span>
                                        Possible Causes
                                    </h3>
                                    <div className="space-y-4">
                                        {result.causes.lifestyle && result.causes.lifestyle.length > 0 && (
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Lifestyle</p>
                                                <ul className="space-y-1">
                                                    {result.causes.lifestyle.map((c, i) => <li key={i} className="text-sm text-slate-300 flex items-start gap-2"><span className="text-purple-500 mt-1">•</span>{c}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        {result.causes.medical && result.causes.medical.length > 0 && (
                                            <div className="pt-2 border-t border-white/5">
                                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 mt-2">Medical / Biological</p>
                                                <ul className="space-y-1">
                                                    {result.causes.medical.map((c, i) => <li key={i} className="text-sm text-slate-300 flex items-start gap-2"><span className="text-purple-500 mt-1">•</span>{c}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Precautions & Doctor */}
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="bg-gradient-to-r from-emerald-900/20 to-teal-900/10 border border-emerald-500/20 rounded-2xl p-6">
                                    <h3 className="text-md font-bold text-white flex items-center gap-2 mb-4">
                                        <span>🥗</span>
                                        Precautions & Diet Suggestions
                                    </h3>
                                    <div className="grid gap-3">
                                        {result.precautions.map((p, i) => (
                                            <div key={i} className="bg-black/20 border border-emerald-500/10 p-3 rounded-xl text-sm text-emerald-100/90 flex items-start gap-2">
                                                <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                                                {p}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-gradient-to-r from-indigo-900/20 to-blue-900/10 border border-indigo-500/20 rounded-2xl p-6">
                                    <h3 className="text-md font-bold text-white flex items-center gap-2 mb-4">
                                        <span>👨‍⚕️</span>
                                        When to Consult a Doctor
                                    </h3>
                                    <div className="bg-black/20 border border-indigo-500/10 p-4 rounded-xl text-sm text-indigo-100/90 leading-relaxed">
                                        {result.consult_doctor || "If you experience severe pain, blood in urine, or persistent symptoms, consult a healthcare professional immediately."}
                                    </div>
                                </div>
                            </div>

                            {/* Actions / Utilities */}
                            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/10">
                                <button onClick={() => window.print()} className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-colors shadow-lg border border-blue-500/30">
                                    {Icons.download}
                                    Download Report
                                </button>
                                <button onClick={() => setPhase('upload')} className="py-3 px-6 text-slate-400 hover:text-white transition-colors">
                                    New Scan
                                </button>
                            </div>

                            {/* Disclaimer */}
                            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-center">
                                <p className="text-xs text-red-300">
                                    This AI analysis is not a substitute for professional medical diagnosis.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
                <div className="max-w-5xl mx-auto">
                    <NearbyDoctors searchType="general" title="Nearby Kidney Specialists & Hospitals" />
                </div>
            </div>

            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #pdf-report-content, #pdf-report-content * { visibility: visible; }
                    #pdf-report-content { position: absolute; left: 0; top: 0; width: 100%; color: black !important; padding: 20px;}
                    button { display: none !important; }
                    .bg-gradient-to-br, .bg-white\\/5 { background: #f8fafc !important; border: 1px solid #e2e8f0 !important;}
                    h2, h3, p, span, li { color: black !important; }
                }
            `}</style>
        </div>
    );
};

export default KidneyDiseaseAnalyzer;
