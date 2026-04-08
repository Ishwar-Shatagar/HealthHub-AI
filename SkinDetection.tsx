import React, { useState, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { analyzeSkinCondition } from '../services/geminiService';
import { SkinAnalysisResult } from '../types';
import { ICONS } from '../constants';
import NearbyDoctors from '../components/NearbyDoctors';

const SkinDetection: React.FC = () => {
    const { navigateTo } = useAppContext();
    const [image, setImage] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [result, setResult] = useState<SkinAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Please upload a valid image file.');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                setImage(base64);
                setMimeType(file.type);
                setError(null);
                setResult(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const runAnalysis = async () => {
        if (!image) return;

        setIsAnalyzing(true);
        setIsScanning(true);
        setError(null);

        try {
            const data = await analyzeSkinCondition(image, mimeType);
            setResult(data);
        } catch (err) {
            console.error('Analysis failed:', err);
            setError('Failed to analyze skin condition. Please try again.');
        } finally {
            setIsAnalyzing(false);
            setIsScanning(false);
        }
    };



    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'Mild': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'Moderate': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case 'Serious': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        }
    };

    return (
        <>
            <div className="relative min-h-screen text-white pb-20 overflow-hidden font-sans">
                {/* Background */}
                <div className="fixed inset-0 z-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-gray-900 to-black"></div>
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 pt-8 space-y-8 animate-fade-in">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigateTo('DASHBOARD')}
                            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                        >
                            <span className="group-hover:-translate-x-1 block transition-transform">{ICONS.arrowLeft}</span>
                        </button>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tighter">
                                Skin <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">AI Lab</span>
                            </h1>
                            <p className="text-blue-100/60 font-medium">Advanced Dermatological Visual Analysis</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* LEFT: Upload Section */}
                        <div className="lg:col-span-5 space-y-6">
                            <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[300px] overflow-hidden ${image ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageUpload}
                                        className="hidden"
                                        accept="image/*"
                                    />

                                    {image ? (
                                        <div className="relative w-full h-full animate-fade-in">
                                            <img
                                                src={`data:${mimeType};base64,${image}`}
                                                alt="Skin Condition"
                                                className="w-full h-64 object-cover rounded-xl shadow-lg"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center pb-4">
                                                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 drop-shadow-md">Image Uploaded</span>
                                            </div>
                                            {isScanning && (
                                                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                                                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_#34d399] animate-scan"></div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 text-emerald-400">
                                                {ICONS.report}
                                            </div>
                                            <p className="text-sm font-bold text-white mb-2">Upload Skin Photo</p>
                                            <p className="text-xs text-white/40 text-center px-4">Drag and drop or click to browse. Ensure the area is well-lit.</p>
                                        </>
                                    )}
                                </div>

                                <button
                                    onClick={runAnalysis}
                                    disabled={!image || isAnalyzing}
                                    className="w-full py-4 mt-6 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold text-white shadow-lg shadow-emerald-900/20 transition-all active:scale-95 flex items-center justify-center gap-2 overflow-hidden relative group"
                                >
                                    {isAnalyzing ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span>AI Processing...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <span>Initialize Neural Scan</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {error && (
                                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium animate-shake">
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Results Section */}
                        <div className="lg:col-span-7 space-y-6">
                            {result ? (
                                <div className="animate-fade-in space-y-6">

                                    {/* Main Identification */}
                                    <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h2 className="text-3xl font-black text-white mb-2">{result.diseaseName}</h2>
                                                <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${getSeverityColor(result.severity)}`}>
                                                    Severity: {result.severity}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-emerald-500/20 rounded-2xl border border-emerald-500/20">
                                                <span className="text-emerald-400">{ICONS.diet}</span>
                                            </div>
                                        </div>

                                        <p className="text-blue-100/80 leading-relaxed font-medium mb-8">
                                            {result.explanation}
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <ResultList title="Possible Causes" items={result.causes} icon="🔍" />
                                            <ResultList title="Home Remedies" items={result.homeRemedies} icon="🏠" />
                                            <ResultList title="Medical Treatments" items={result.medicalTreatments} icon="🏥" />

                                        </div>
                                    </div>

                                    {/* Disclaimer */}
                                    <div className="p-6 rounded-2xl bg-yellow-500/5 border border-yellow-500/20 text-center">
                                        <p className="text-xs text-yellow-200/60 leading-relaxed italic">
                                            <span className="font-bold text-yellow-500">MEDICAL DISCLAIMER:</span> {result.disclaimer}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 border-dashed">
                                    <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6 text-white/10">
                                        {ICONS.chatbot}
                                    </div>
                                    <h3 className="text-xl font-bold text-white/40 tracking-tight">System Idle</h3>
                                    <p className="text-sm text-white/20 mt-3 max-w-xs leading-relaxed">Please capture and upload a clear, well-lit image of the skin condition for neural processing.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <style>{`
                @keyframes scan {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(256px); }
                }
                .animate-scan {
                    animation: scan 2s linear infinite;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.4s ease-in-out;
                }
            `}</style>
                </div>
            </div>
            <NearbyDoctors searchType="general" title="Nearby Dermatologists & Skin Clinics" />
        </>
    );
};

const ResultList: React.FC<{ title: string; items: string[]; icon: string }> = ({ title, items, icon }) => (
    <div className="bg-white/5 p-4 rounded-3xl border border-white/10 group hover:bg-white/15 transition-all">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-200/40 mb-3 flex items-center gap-2">
            <span>{icon}</span> {title}
        </h4>
        <div className="flex flex-wrap gap-2">
            {items?.length > 0 ? items.map((item, i) => (
                <span key={i} className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white/5 border border-white/10 text-white/70 group-hover:bg-white/10 transition-colors">
                    {item}
                </span>
            )) : <span className="text-[10px] text-white/20">No data available</span>}
        </div>
    </div>
);

export default SkinDetection;
