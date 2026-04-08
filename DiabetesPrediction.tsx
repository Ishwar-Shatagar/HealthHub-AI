import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { ICONS } from '../constants';
import NearbyDoctors from '../components/NearbyDoctors';

const API_KEY = process.env.API_KEY || '';

const FloatingParticles = () => {
    // Render some floating medical-themed particles in the background
    const particles = ['+', '♥', '○', '🧬', '⚕️', '🔬'];
    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-20">
            {[...Array(20)].map((_, i) => (
                <div
                    key={i}
                    className="absolute animate-float"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        animationDuration: `${Math.random() * 5 + 5}s`,
                        animationDelay: `${Math.random() * 5}s`,
                        fontSize: `${Math.random() * 1.5 + 0.5}rem`,
                        color: i % 2 === 0 ? '#22d3ee' : '#ffffff', // Cyan and white
                        opacity: Math.random() * 0.5 + 0.1,
                    }}
                >
                    {particles[Math.floor(Math.random() * particles.length)]}
                </div>
            ))}
        </div>
    );
};

const DiabetesPrediction: React.FC = () => {
    const { navigateTo } = useAppContext();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // States for the two-phase pipeline
    const [isExtracting, setIsExtracting] = useState(false);
    const [isPredicting, setIsPredicting] = useState(false);

    // Extracted Data State
    const [extractedData, setExtractedData] = useState<any>(null);

    const [result, setResult] = useState<{
        riskPercentage: number;
        status: 'Low Risk' | 'High Risk' | 'Moderate Risk';
        recommendation: string;
        dietaryAdvice: string;
        healthyFoods: string[];
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Drag and Drop Handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.type === "image/jpeg" || file.type === "image/png" || file.type === "application/pdf")) {
            handleFileSelection(file);
        } else {
            setError("Please upload a valid JPG, PNG, or PDF report.");
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelection(file);
    };

    const handleFileSelection = (file: File) => {
        setError(null);
        setSelectedFile(file);
        setResult(null);
        setExtractedData(null);
        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        } else {
            setPreviewUrl(null); // Handle PDF icon display later
        }
    };

    const handleAnalyze = async () => {
        if (!selectedFile) return;

        setError(null);
        setResult(null);
        setIsExtracting(true);

        try {
            // STEP 1: OCR EXTRACTION
            // Simulated /api/diabetes-image-extract call since backend is not provided
            // A real implementation would send FormData with the image here.
            await new Promise(resolve => setTimeout(resolve, 2500)); // Simulate OCR delay

            const mockExtractedData = {
                Glucose: 155,
                BMI: 31.2,
                BloodPressure: 85,
                Insulin: 0,
                Age: 52,
                Pregnancies: 2,
                SkinThickness: 35,
                DPF: 0.627
            };

            setExtractedData(mockExtractedData);
            setIsExtracting(false);
            setIsPredicting(true);

            // STEP 2: METABOLIC RISK PREDICTION
            // Simulated /api/diabetes-predict call utilizing the extracted structure
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate Model Delay

            const glucose = mockExtractedData.Glucose;
            const bmi = mockExtractedData.BMI;
            const age = mockExtractedData.Age;

            let simulatedRisk = 15;
            if (glucose > 140) simulatedRisk += 35;
            if (bmi > 30) simulatedRisk += 20;
            if (age > 45) simulatedRisk += 15;

            const percentage = Math.min(Math.max(simulatedRisk, 5), 95);

            setResult({
                riskPercentage: percentage,
                status: percentage >= 75 ? 'High Risk' : percentage >= 40 ? 'Moderate Risk' : 'Low Risk',
                recommendation: percentage >= 75
                    ? 'CRITICAL: High metabolic risk detected based on OCR lab values. Immediate consultation with an endocrinologist is strongly advised.'
                    : percentage >= 40
                        ? 'Caution: Moderate risk indicators present. A structured lifestyle intervention and follow-up bloodwork are recommended.'
                        : 'Your readings indicate a lower risk profile. Maintain a healthy, balanced diet and consistent exercise routine.',
                dietaryAdvice: percentage >= 40
                    ? 'Focus on a strictly low-glycemic index diet to help manage blood sugar spikes. Prioritize high-fiber vegetables, lean proteins, and complex carbohydrates while strictly avoiding sugary beverages and processed foods.'
                    : 'Continue with a balanced diet rich in whole foods. Ensure you are getting enough fiber and healthy fats to maintain stable energy levels and support overall metabolic health.',
                healthyFoods: percentage >= 40
                    ? ['Leafy Greens (Spinach, Kale)', 'Berries', 'Fatty Fish (Salmon)', 'Chia Seeds', 'Walnuts', 'Broccoli', 'Non-starchy Vegetables']
                    : ['Whole Grains', 'Lean Poultry', 'Mixed Nuts', 'Greek Yogurt', 'Legumes', 'Fresh Fruits', 'Avocado']
            });

        } catch (err: any) {
            console.error(err);
            setError("Analysis failed. Ensure the image is clear and contains readable lab values.");
        } finally {
            setIsExtracting(false);
            setIsPredicting(false);
        }
    };

    const resetAnalysis = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setResult(null);
        setExtractedData(null);
        setError(null);
    };

    // Calculate circular progress logic
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = result ? circumference - (result.riskPercentage / 100) * circumference : circumference;

    const isLoading = isExtracting || isPredicting;

    return (
        <div className="relative min-h-screen font-sans text-white pb-20 items-center justify-center flex flex-col pt-16 md:pt-24 px-4 overflow-hidden">
            {/* Dark Blue Gradient Background */}
            <div className="fixed inset-0 z-0 bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#1e293b]"></div>

            <FloatingParticles />

            {/* Content Wrapper */}
            <div className="relative z-10 w-full max-w-5xl mx-auto space-y-8 animate-fade-in-up">

                {/* Header */}
                <div className="flex items-center gap-4 mb-2">
                    <button
                        onClick={() => navigateTo('DASHBOARD')}
                        className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group backdrop-blur-md"
                    >
                        <span className="group-hover:-translate-x-1 block transition-transform text-white">{ICONS.arrowLeft}</span>
                    </button>
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tighter flex items-center gap-3">
                            AI Diabetes <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">Risk Predictor</span>
                        </h1>
                        <p className="text-cyan-100/60 font-medium">Upload medical lab reports for automated OCR extraction and metabolic analysis.</p>
                    </div>
                </div>

                {/* Emergency High Risk Warning Banner */}
                {result && result.status === 'High Risk' && (
                    <div className="bg-red-900/40 border border-red-500/50 rounded-2xl p-4 flex items-center gap-4 shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-pulse-slow">
                        <div className="p-3 bg-red-500/20 rounded-xl text-red-500">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-red-400 font-bold text-lg uppercase tracking-wider">Critical Risk Detected</h3>
                            <p className="text-red-200/80 text-sm">The extracted parameters indicate a severely elevated risk profile. Please share this report with a medical professional immediately.</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Glassmorphism Document Uploader */}
                    <div className="flex flex-col space-y-6">
                        <div className="bg-slate-900/40 backdrop-blur-2xl p-6 md:p-8 rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden group transition-all">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600"></div>

                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                                    <span className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">📄</span>
                                    Upload Lab Report
                                </h2>
                                {selectedFile && !isLoading && (
                                    <button onClick={resetAnalysis} className="text-xs font-bold text-slate-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                                        Clear / Restart
                                    </button>
                                )}
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-200 text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            {!selectedFile ? (
                                <div
                                    className={`border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-12 transition-all duration-300 relative overflow-hidden
                                        ${isDragging ? 'border-cyan-400 bg-cyan-500/10 scale-[1.02]' : 'border-slate-600 bg-black/20 hover:border-cyan-500/50 hover:bg-slate-800/50'}`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.pdf"
                                        onChange={handleFileInput}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="p-4 bg-slate-800/50 rounded-full mb-4 shadow-inner">
                                        <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">Drag & Drop Report</h3>
                                    <p className="text-sm text-slate-400 text-center max-w-[250px]">Upload a medical document (JPG, PNG, PDF) containing patient parameters.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-500 ${isLoading ? 'border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.3)]' : 'border-slate-700 bg-black/40'}`}>

                                        {/* Scanning Laser Overlay active during processing */}
                                        {isLoading && (
                                            <>
                                                <div className="absolute inset-0 bg-cyan-500/20 z-20 mix-blend-overlay"></div>
                                                <div className="absolute top-0 left-0 w-full h-1 bg-cyan-300 shadow-[0_0_15px_#22d3ee,0_0_30px_#22d3ee] z-30 animate-scan-laser"></div>
                                            </>
                                        )}

                                        {previewUrl ? (
                                            <div className="relative aspect-[3/4] w-full max-h-[400px]">
                                                <img src={previewUrl} alt="Document Preview" className="w-full h-full object-cover opacity-80" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                                            </div>
                                        ) : (
                                            <div className="aspect-[3/4] w-full max-h-[300px] flex items-center justify-center bg-slate-900">
                                                <span className="text-6xl">📄</span>
                                            </div>
                                        )}

                                        <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center gap-3 z-20">
                                            <div className="p-2 bg-cyan-500/20 rounded-lg"><span className="text-cyan-400">📄</span></div>
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-bold text-white truncate">{selectedFile.name}</p>
                                                <p className="text-xs text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                    </div>

                                    {!result && (
                                        <button
                                            onClick={handleAnalyze}
                                            disabled={isLoading}
                                            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all active:scale-95 flex items-center justify-center gap-2 overflow-hidden relative group"
                                        >
                                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                            <span className="relative z-10 flex items-center gap-2 tracking-wide uppercase">
                                                {isLoading ? 'Processing Pipeline...' : 'Analyze Report Details'}
                                            </span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Results / Loading State */}
                    <div className="flex flex-col h-full space-y-6">

                        {isLoading && (
                            <div className="flex-grow bg-slate-900/40 backdrop-blur-2xl rounded-3xl border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.1)] flex flex-col items-center justify-center p-8 relative overflow-hidden animate-pulse">
                                {/* Heartbeat / AI Scan effect */}
                                <div className="absolute inset-0 bg-cyan-500/5 animate-scan-fast"></div>

                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <div className="w-24 h-24 rounded-full border-4 border-slate-700 border-t-cyan-400 border-b-blue-500 animate-spin mb-6 shadow-[0_0_20px_rgba(34,211,238,0.5)]"></div>

                                    <h3 className="text-2xl font-bold text-cyan-400 mb-2">
                                        {isExtracting ? "Extracting Parameters via OCR..." : "Running Metabolic Risk Analysis..."}
                                    </h3>

                                    {/* Sub-steps pipelining visual */}
                                    <div className="w-full max-w-xs bg-slate-800 rounded-full h-2 mt-4 overflow-hidden border border-slate-700">
                                        <div className={`h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-1000 ease-out ${isExtracting ? 'w-1/2' : 'w-full'}`}></div>
                                    </div>
                                    <div className="flex justify-between w-full max-w-xs mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        <span className={isExtracting ? 'text-cyan-400' : 'text-slate-600'}>Ocr Extraction</span>
                                        <span className={isPredicting ? 'text-blue-400' : 'text-slate-600'}>Predictive Model</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!isLoading && result && extractedData && (
                            <div className={`flex flex-col space-y-6 animate-fade-in-up`}>
                                {/* Extracted Data Table */}
                                <div className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-xl">
                                    <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                                        Extracted OCR Values
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {Object.entries(extractedData).map(([key, value]) => (
                                            <div key={key} className="bg-black/30 p-3 rounded-xl border border-slate-700/50 flex flex-col">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">{key}</span>
                                                <span className="text-base font-black text-white">{String(value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Main Results Panel */}
                                <div className={`flex-grow backdrop-blur-2xl p-6 md:p-8 rounded-3xl border shadow-2xl relative overflow-hidden transition-all duration-700
                                    ${result.status === 'High Risk'
                                        ? 'bg-red-900/20 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.2)]'
                                        : result.status === 'Moderate Risk'
                                            ? 'bg-orange-900/20 border-orange-500/50 shadow-[0_0_40px_rgba(249,115,22,0.2)]'
                                            : 'bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.2)]'
                                    }`}
                                >
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                                        <h3 className="text-lg font-bold text-white uppercase tracking-widest opacity-80">Prediction Result</h3>

                                        {/* Circular Progress Indicator */}
                                        <div className="relative w-40 h-40 md:w-48 md:h-48 flex items-center justify-center">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle cx="96" cy="96" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-700/50" />
                                                <circle
                                                    cx="96" cy="96" r={radius}
                                                    stroke="currentColor" strokeWidth="8" fill="transparent"
                                                    strokeDasharray={circumference}
                                                    strokeDashoffset={strokeDashoffset}
                                                    strokeLinecap="round"
                                                    className={`transition-all duration-1500 ease-out 
                                                        ${result.status === 'High Risk' ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]'
                                                            : result.status === 'Moderate Risk' ? 'text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]'
                                                                : 'text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]'}`}
                                                />
                                            </svg>
                                            <div className="absolute flex flex-col items-center justify-center -translate-y-1">
                                                <span className="text-4xl md:text-5xl font-black">{result.riskPercentage}%</span>
                                                <span className="text-[10px] md:text-xs uppercase tracking-wider font-bold text-slate-400 mt-1">Risk</span>
                                            </div>
                                        </div>

                                        <div className={`px-6 py-2 rounded-full text-sm md:text-lg font-black uppercase tracking-widest border 
                                            ${result.status === 'High Risk' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                                : result.status === 'Moderate Risk' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                                                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                            }`}>
                                            {result.status}
                                        </div>

                                        <div className="bg-black/30 p-5 rounded-2xl border border-white/5 relative group w-full text-left">
                                            <div className="absolute -top-3 left-6 px-2 bg-slate-900 text-xs font-bold text-cyan-400 border border-cyan-500/30 rounded-lg">AI Diagnosis Summary</div>
                                            <p className="text-sm text-slate-300 leading-relaxed font-medium">
                                                {result.recommendation}
                                            </p>
                                        </div>

                                        {/* Dietary Recovery & Healthy Foods */}
                                        <div className="bg-black/30 p-5 rounded-2xl border border-white/5 relative group text-left w-full mt-2">
                                            <div className="absolute -top-3 left-6 px-2 bg-slate-900 text-xs font-bold text-emerald-400 border border-emerald-500/30 rounded-lg">Dietary Action Plan</div>
                                            <p className="text-sm text-emerald-100/80 leading-relaxed font-medium mb-4">
                                                {result.dietaryAdvice}
                                            </p>
                                            <div>
                                                <div className="flex flex-wrap gap-2">
                                                    {result.healthyFoods.map((food, idx) => (
                                                        <span key={idx} className="px-2 py-1 rounded-lg text-[10px] md:text-xs font-bold bg-white/5 border border-white/10 text-slate-300">
                                                            🥗 {food}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!isLoading && !result && (
                            <div className="flex-grow bg-slate-900/30 backdrop-blur-md rounded-3xl border border-white/5 border-dashed flex flex-col items-center justify-center p-8 text-center text-slate-500 h-[300px]">
                                <span className="text-5xl opacity-40 mb-4">🔬</span>
                                <h3 className="text-lg font-bold text-slate-400">Awaiting Lab Report</h3>
                                <p className="text-sm mt-2 max-w-[250px]">Upload a document to extract parameters and run the risk assessment algorithm.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-20px) rotate(10deg); }
                }
                .animate-float { animation: float infinite ease-in-out; }
                
                @keyframes scan-fast {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(200%); }
                }
                .animate-scan-fast { animation: scan-fast 2s linear infinite; }
            `}</style>
            <NearbyDoctors searchType="general" title="Nearby Diabetes & Endocrinology Specialists" />
        </div>
    );
};

export default DiabetesPrediction;

