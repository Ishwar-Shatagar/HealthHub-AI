import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAppContext } from '../context/AppContext';
import { ICONS, LANGUAGES } from '../constants';
import { TRANSLATIONS } from '../constants/translations';
import { Page } from '../types';
import { generateHealthTip } from '../services/geminiService';
import { getErrorMessage } from '../utils/helpers';
import { calculateMaintenanceCalories } from '../services/helpers';
import { sendDailyReport } from '../services/emailService';
import { Hyperspeed, hyperspeedPresets } from '../components/ui/Hyperspeed';

interface FeatureCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    page: Page;
    colorClass: string;
    gradient: string;
}

// LiquidGlassCard Component (Reusable Wrapper)
export const LiquidGlassCard = ({ children, className = '', containerClassName = '' }: { children: React.ReactNode, className?: string, containerClassName?: string }) => {
    const cardRef = React.useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        cardRef.current.style.setProperty('--x', `${x}px`);
        cardRef.current.style.setProperty('--y', `${y}px`);
    };

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            className={`group relative overflow-hidden rounded-[30px] border border-white/10 hover:border-white/20 bg-white/[0.03] backdrop-blur-[40px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.4),inset_0_-1px_2px_rgba(0,0,0,0.1)] transition-all duration-700 ${containerClassName}`}
        >
            {/* Dynamic Spotlight */}
            <div className="pointer-events-none absolute -inset-px rounded-[30px] opacity-0 transition duration-500 group-hover:opacity-100 z-0" style={{ background: 'radial-gradient(800px circle at var(--x, 50%) var(--y, 50%), rgba(255,255,255,0.15), transparent 40%)' }}></div>
            {/* Frosted Inner Glass */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/10 via-white/5 to-black/30 mix-blend-overlay z-0"></div>
            <div className={`relative z-10 w-full h-full ${className}`}>
                {children}
            </div>
        </div>
    );
};

// Memoized FeatureCard Component with Premium Glassmorphism
const FeatureCard = React.memo(({ title, description, icon, onClick, colorClass, gradient }: FeatureCardProps & { onClick: () => void }) => (
    <LiquidGlassCard containerClassName="p-6 cursor-pointer hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
        <div onClick={onClick} className="w-full h-full flex flex-col items-start relative z-10">
            {/* Glow and Shimmer Overlay */}
            <div className={`absolute -inset-6 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-[0.15] transition-opacity duration-700 z-0 mix-blend-color pointer-events-none rounded-[30px]`}></div>

            {/* Hover Highlight */}
            <div className="absolute -inset-2 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0 mix-blend-overlay bg-gradient-to-tr from-white/10 via-transparent to-white/40"></div>

            <div className="relative z-10 flex flex-col h-full w-full">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-xl ${colorClass} text-white transform group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 ring-4 ring-white/10 dark:ring-black/10`}>
                    {React.cloneElement(icon as React.ReactElement<any>, {
                        className: "w-7 h-7",
                        strokeWidth: 2
                    })}
                </div>

                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300 transition-all duration-300">
                    {title}
                </h3>
                <p className="text-sm text-blue-100/70 leading-relaxed mb-4 flex-grow font-medium">
                    {description}
                </p>

                <div className="flex items-center text-xs font-bold text-white uppercase tracking-wider opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                    <span>Explore</span>
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                </div>
            </div>
        </div>
    </LiquidGlassCard>
));

const Dashboard: React.FC = () => {
    const { user, dailyLog, logHistory, navigateTo, isDarkMode, healthTipData, setHealthTipData, language, setLanguage } = useAppContext();
    const [tipError, setTipError] = useState('');
    const [isTipLoading, setIsTipLoading] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const t = TRANSLATIONS[language] || TRANSLATIONS['English'];

    // Health Tip Speech Synthesis State
    const [isTipSpeaking, setIsTipSpeaking] = useState(false);
    const tipUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    // Effect for speech synthesis setup
    useEffect(() => {
        const handleVoicesChanged = () => {
            setVoices(speechSynthesis.getVoices());
        };
        speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
        handleVoicesChanged(); // Initial load

        const utterance = new SpeechSynthesisUtterance();
        utterance.onstart = () => setIsTipSpeaking(true);
        utterance.onend = () => setIsTipSpeaking(false);
        utterance.onerror = (e) => {
            if (e.error !== 'interrupted') {
                console.error("Speech synthesis error:", e.error);
            }
            setIsTipSpeaking(false);
        };
        tipUtteranceRef.current = utterance;

        return () => {
            speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
            speechSynthesis.cancel();
        };
    }, []);

    // Effect for fetching health tip - NOW USES CACHING
    useEffect(() => {
        // If we already have a tip in the selected language, don't refetch
        if (healthTipData && healthTipData.language === language) {
            setIsTipLoading(false);
            setTipError('');
            return;
        }

        setIsTipLoading(true);
        setTipError('');
        speechSynthesis.cancel();

        generateHealthTip(language)
            .then(tip => {
                setHealthTipData({ text: tip, language: language });
            })
            .catch(err => {
                console.error("Failed to generate health tip:", err);
                setTipError(getErrorMessage(err));
            })
            .finally(() => setIsTipLoading(false));
    }, [language, healthTipData, setHealthTipData]);

    const healthTip = healthTipData?.text || '';

    const handleToggleTipSpeech = () => {
        if (!tipUtteranceRef.current || !healthTip) return;

        if (isTipSpeaking) {
            speechSynthesis.cancel();
        } else {
            tipUtteranceRef.current.text = healthTip;
            const langCodeMap: { [key: string]: string } = {
                'English': 'en-US', 'Hindi': 'hi-IN', 'Kannada': 'kn-IN', 'Tamil': 'ta-IN',
                'Telugu': 'te-IN', 'Bengali': 'bn-IN', 'Marathi': 'mr-IN', 'Gujarati': 'gu-IN'
            };
            const langCode = langCodeMap[language] || 'en-US';
            tipUtteranceRef.current.lang = langCode;
            const bestVoice = voices.find(v => v.lang === langCode) || voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
            tipUtteranceRef.current.voice = bestVoice || null;
            speechSynthesis.speak(tipUtteranceRef.current);
        }
    };

    const features: FeatureCardProps[] = [
        { title: "QuantumPulse AI", description: "Contactless ambient health monitoring via WiFi & EM waves.", icon: ICONS.wifi, page: 'QUANTUM_PULSE', colorClass: 'bg-cyan-500', gradient: 'from-cyan-400 to-blue-600' },
        { title: "Drug Impact Visualizer", description: "Analyze how a drug affects the human body.", icon: ICONS.diet, page: 'DRUG_VISUALIZER', colorClass: 'bg-rose-500', gradient: 'from-rose-400 to-red-600' },
        { title: "Medical Imaging AI", description: "Upload X-Ray, MRI or CT scans for AI-powered diagnostic analysis.", icon: ICONS.report, page: 'MEDICAL_IMAGING', colorClass: 'bg-sky-500', gradient: 'from-sky-400 to-indigo-600' },
        { title: "Skin AI Lab", description: "AI-powered dermatological analysis and specialist finder.", icon: ICONS.diet, page: 'SKIN_DETECTION', colorClass: 'bg-emerald-500', gradient: 'from-emerald-400 to-cyan-600' },
        { title: "Heart Disease AI", description: "AI-driven analysis for heart health.", icon: ICONS.report, page: 'HEART_DISEASE_ANALYZER', colorClass: 'bg-red-500', gradient: 'from-red-400 to-rose-600' },
        { title: "Kidney Disease AI", description: "Assess kidney health risks via AI.", icon: ICONS.report, page: 'KIDNEY_DISEASE_ANALYZER', colorClass: 'bg-blue-500', gradient: 'from-blue-400 to-indigo-600' },
        { title: t.features.exercise_corner.title, description: t.features.exercise_corner.desc, icon: ICONS.exercise, page: 'EXERCISE_CORNER', colorClass: 'bg-purple-500', gradient: 'from-purple-400 to-pink-600' },
        { title: t.features.report_analyzer.title, description: t.features.report_analyzer.desc, icon: ICONS.report, page: 'REPORT_ANALYZER', colorClass: 'bg-blue-500', gradient: 'from-blue-400 to-indigo-600' },
        { title: "Oncology AI Lab", description: "Advanced cancer detection and specialist finder.", icon: ICONS.report, page: 'CANCER_DETECTION', colorClass: 'bg-fuchsia-500', gradient: 'from-fuchsia-400 to-purple-600' },
        { title: "Activity Tracker", description: "Track your steps and calories in real-time.", icon: ICONS.exercise, page: 'ACTIVITY_TRACKER', colorClass: 'bg-cyan-500', gradient: 'from-cyan-400 to-blue-600' },
        { title: "Gym Management", description: "Build your perfect workout routine.", icon: ICONS.dumbbell, page: 'GYM_MANAGEMENT', colorClass: 'bg-cyan-500', gradient: 'from-cyan-400 to-blue-600' },
        { title: t.features.calorie_counter.title, description: t.features.calorie_counter.desc, icon: ICONS.flame, page: 'CALORIE_COUNTER', colorClass: 'bg-orange-500', gradient: 'from-orange-400 to-red-600' },
        { title: t.features.diet_plan.title, description: t.features.diet_plan.desc, icon: ICONS.diet, page: 'DIET_PLANNER', colorClass: 'bg-emerald-500', gradient: 'from-emerald-400 to-teal-600' },
        { title: t.features.health_services.title, description: t.features.health_services.desc, icon: ICONS.mapPin, page: 'LOCATION_TRACKER', colorClass: 'bg-rose-500', gradient: 'from-rose-400 to-red-600' },
        // Appending the remaining modules not explicitly listed in the prompt
        { title: "Diabetes Risk Predictor", description: "AI-driven assessment for early diabetes detection.", icon: ICONS.report, page: 'DIABETES_PREDICTION', colorClass: 'bg-cyan-500', gradient: 'from-cyan-400 to-blue-600' },
        { title: t.features.todays_goal.title, description: t.features.todays_goal.desc, icon: ICONS.goal, page: 'TODAYS_GOAL', colorClass: 'bg-indigo-500', gradient: 'from-indigo-400 to-violet-600' },
    ];

    // Memoized Calculations
    const chartData = React.useMemo(() => logHistory.map(log => ({
        ...log,
        name: new Date(log.date).toLocaleString('en-US', { weekday: 'short' }),
    })), [logHistory]);

    const maintenanceCalories = React.useMemo(() => user ? calculateMaintenanceCalories(user) : 2000, [user]);

    // Filter foods by source
    const intakeFoods = React.useMemo(() => dailyLog.loggedFoods.filter(f => f.source === 'counter'), [dailyLog.loggedFoods]);
    const targetFoods = React.useMemo(() => dailyLog.loggedFoods.filter(f => f.source === 'plan'), [dailyLog.loggedFoods]);

    // Calculate totals based on source
    const consumedCalories = React.useMemo(() => intakeFoods.reduce((sum, food) => sum + food.calories, 0), [intakeFoods]);
    const plannedCalories = React.useMemo(() => targetFoods.reduce((sum, food) => sum + food.calories, 0), [targetFoods]);

    const progress = React.useMemo(() => Math.min((consumedCalories / maintenanceCalories) * 100, 100), [consumedCalories, maintenanceCalories]);
    const netCalories = React.useMemo(() => consumedCalories - dailyLog.caloriesOut, [consumedCalories, dailyLog.caloriesOut]);

    const weightStatus = React.useMemo(() => {
        if (!user) return null;
        const bmi = user.bmi;
        if (bmi < 18.5) return { status: t.bmi_status_underweight, color: 'text-blue-500', bg: 'bg-blue-500', gradient: 'from-blue-400 to-blue-600' };
        if (bmi < 25) return { status: t.bmi_status_normal, color: 'text-green-500', bg: 'bg-green-500', gradient: 'from-green-400 to-emerald-600' };
        if (bmi < 30) return { status: t.bmi_status_overweight, color: 'text-orange-500', bg: 'bg-orange-500', gradient: 'from-orange-400 to-orange-600' };
        return { status: t.bmi_status_obese, color: 'text-red-500', bg: 'bg-red-500', gradient: 'from-red-400 to-red-600' };
    }, [user, t]);

    const handleSendReport = async () => {
        if (!user || !user.email) {
            alert("No email address found for user.");
            return;
        }
        setIsSendingEmail(true);
        setEmailStatus('idle');
        try {
            await sendDailyReport(user.email, {
                intake: consumedCalories,
                burned: dailyLog.caloriesOut,
                net: netCalories,
                date: dailyLog.date,
                foods: intakeFoods
            });
            setEmailStatus('success');
            setTimeout(() => setEmailStatus('idle'), 3000);
        } catch (error: any) {
            console.error("Email failed", error);
            setEmailStatus('error');

            // Check for connection error (Server not running)
            if (error.message && (error.message.includes("Failed to fetch") || error.message.includes("NetworkError"))) {
                alert("❌ Connection Failed!\n\nPlease ensure the BACKEND SERVER is running.\nRun 'node server.js' in a new terminal.");
            } else {
                alert(`❌ Email Failed: ${error.message || "Unknown error"}`);
            }
        } finally {
            setIsSendingEmail(false);
        }
    };

    return (
        <div className="relative min-h-screen text-white pb-20 overflow-hidden font-sans selection:bg-rose-500 selection:text-white">

            {/* iPhone Liquid Glass Ethereal Background */}
            <div className="fixed inset-0 z-0 bg-[#0A0A12] overflow-hidden">
                {/* Glowing pastel liquid orbs */}
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[140px] mix-blend-screen opacity-70 animate-pulse" style={{ animationDuration: '8s' }}></div>
                <div className="absolute top-[20%] right-[-10%] w-[50%] h-[70%] bg-blue-500/20 rounded-full blur-[150px] mix-blend-screen opacity-70 animate-pulse" style={{ animationDuration: '10s' }}></div>
                <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[130px] mix-blend-screen opacity-70 animate-pulse" style={{ animationDuration: '12s' }}></div>
                <div className="absolute top-[40%] left-[40%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[100px] mix-blend-screen opacity-70 animate-pulse" style={{ animationDuration: '9s' }}></div>

                {/* Grainy Noise texture */}
                <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }}></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 pt-8 space-y-10 animate-fade-in">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-2">
                            {t.hello}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{user?.name}</span>
                        </h2>
                        <p className="text-lg text-blue-100/70 font-medium">{t.subtitle}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSendReport}
                            disabled={isSendingEmail || emailStatus === 'success'}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md ${emailStatus === 'success'
                                ? 'bg-green-500/20 text-green-200 border-green-500/30'
                                : emailStatus === 'error'
                                    ? 'bg-red-500/20 text-red-200 border-red-500/30 hover:bg-red-500/30'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                        >
                            {isSendingEmail ? (
                                <>
                                    <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Sending...</span>
                                </>
                            ) : emailStatus === 'success' ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    <span>Sent!</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                    <span>Report</span>
                                </>
                            )}
                        </button>

                        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-lg">
                            <div className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold text-white uppercase tracking-wider">
                                {t.language}
                            </div>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer py-2 pr-4 pl-2 hover:text-blue-300 transition-colors [&>option]:text-gray-900"
                            >
                                {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Health Tip Banner */}
                <LiquidGlassCard containerClassName="group">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-teal-700/20 to-blue-800/20 pointer-events-none mix-blend-color"></div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3 group-hover:scale-110 transition-transform duration-1000 z-0 pointer-events-none"></div>

                    <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
                        <div className="flex-shrink-0 p-4 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner border border-white/20">
                            {React.cloneElement(ICONS.lightbulb as React.ReactElement<any>, { className: "w-8 h-8 text-yellow-300" })}
                        </div>

                        <div className="flex-grow space-y-2">
                            <div className="flex items-center gap-3">
                                <span className="px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider border border-white/20 backdrop-blur-sm shadow-sm">
                                    {t.daily_insight}
                                </span>
                                {isTipLoading && <span className="text-blue-200 text-xs animate-pulse font-mono">{t.generating}</span>}
                            </div>

                            {tipError ? (
                                <p className="text-red-200 bg-red-900/30 p-3 rounded-xl border border-red-500/30 text-sm font-medium">{tipError}</p>
                            ) : (
                                <p className="text-xl md:text-2xl font-serif italic text-white leading-relaxed drop-shadow-sm">
                                    "{healthTip || t.generating}"
                                </p>
                            )}
                        </div>

                        {!isTipLoading && healthTip && (
                            <button
                                onClick={handleToggleTipSpeech}
                                className="flex-shrink-0 p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all duration-300 backdrop-blur-md border border-white/20 group-hover:scale-110 active:scale-95 shadow-lg relative z-20"
                                title={isTipSpeaking ? t.stop : t.listen}
                            >
                                {isTipSpeaking ?
                                    <span className="animate-pulse text-white">{ICONS.speakerOff}</span> :
                                    <span className="text-white">{ICONS.speaker}</span>
                                }
                            </button>
                        )}
                    </div>
                </LiquidGlassCard>

                {/* Feature Grid */}
                <div>
                    <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <span className="w-1 h-8 bg-blue-500 rounded-full"></span>
                        Quick Actions
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map(feature => <FeatureCard key={feature.page} {...feature} onClick={() => navigateTo(feature.page)} />)}
                    </div>
                </div>

                {/* Analytics Section */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                    {/* Today's Intake (Calorie Counter) */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <LiquidGlassCard className="p-8 group h-full">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-bold text-white">{t.todays_intake}</h3>
                                <div className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-gray-300 border border-white/10">
                                    {t.goal}: {maintenanceCalories.toFixed(0)}
                                </div>
                            </div>

                            <div className="relative mb-8">
                                <div className="flex items-baseline justify-center mb-4">
                                    <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 drop-shadow-sm">
                                        {consumedCalories.toFixed(0)}
                                    </span>
                                    <span className="text-lg text-gray-400 font-medium ml-2">kcal</span>
                                </div>

                                <div className="h-4 w-full bg-gray-700/50 rounded-full overflow-hidden p-0.5 shadow-inner border border-white/5">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 shadow-[0_0_20px_rgba(52,211,153,0.5)] transition-all duration-1000 ease-out relative"
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                                    </div>
                                </div>
                                <p className="text-center text-sm text-gray-400 mt-3 font-medium">{progress.toFixed(0)}% {t.of_daily_goal}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex flex-col items-center justify-center">
                                    <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">{t.burned}</p>
                                    <p className="text-xl font-black text-white">{dailyLog.caloriesOut.toFixed(0)}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center">
                                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">{t.net}</p>
                                    <p className="text-xl font-black text-white">{netCalories.toFixed(0)}</p>
                                </div>
                            </div>

                            {weightStatus && (
                                <div className={`mt-6 p-5 rounded-2xl border bg-gradient-to-br ${weightStatus.gradient} text-white shadow-lg relative overflow-hidden`}>
                                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/20 rounded-full blur-xl"></div>
                                    <div className="flex justify-between items-center relative z-10">
                                        <div>
                                            <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">{t.bmi_status}</p>
                                            <p className="text-lg font-bold">{weightStatus.status}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-3xl font-black">{user?.bmi.toFixed(1)}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </LiquidGlassCard>

                        {/* Intake List */}
                        <LiquidGlassCard className="p-6 flex-grow flex flex-col h-[400px]">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                {t.consumed}
                            </h3>
                            {intakeFoods.length > 0 ? (
                                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-grow">
                                    {intakeFoods.map((food, index) => (
                                        <div key={index} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-200 group-hover:text-white transition-colors text-sm">{food.name}</span>
                                            </div>
                                            <span className="font-bold text-emerald-400 text-sm">
                                                {food.calories.toFixed(0)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 border border-dashed border-white/10 rounded-2xl bg-white/5">
                                    <p className="text-sm font-medium">{t.no_intake}</p>
                                </div>
                            )}
                        </LiquidGlassCard>
                    </div>

                    {/* Middle Section - Graphs & Trends */}
                    <div className="lg:col-span-2 flex flex-col gap-8">
                        {/* Graph */}
                        <LiquidGlassCard className="p-8 flex flex-col h-full min-h-[500px]">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                                    {t.activity_trends}
                                </h3>
                                <div className="flex items-center space-x-4 bg-black/20 p-1.5 rounded-xl border border-white/5">
                                    <div className="flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-lg shadow-sm">
                                        <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#10B981]"></span>
                                        <span className="text-xs font-bold text-gray-300">{t.intake}</span>
                                    </div>
                                    <div className="flex items-center space-x-2 px-3 py-1">
                                        <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_#F97316]"></span>
                                        <span className="text-xs font-bold text-gray-400">{t.burned}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-grow">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: -20, bottom: 0 }} barGap={6}>
                                        <defs>
                                            <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10B981" stopOpacity={0.8} />
                                                <stop offset="100%" stopColor="#10B981" stopOpacity={0.1} />
                                            </linearGradient>
                                            <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#F97316" stopOpacity={0.8} />
                                                <stop offset="100%" stopColor="#F97316" stopOpacity={0.1} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }}
                                            axisLine={false}
                                            tickLine={false}
                                            dy={15}
                                        />
                                        <YAxis
                                            tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            contentStyle={{
                                                backgroundColor: 'rgba(17, 24, 39, 0.9)',
                                                borderColor: 'rgba(255,255,255,0.1)',
                                                borderRadius: '16px',
                                                boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.5)',
                                                color: '#F3F4F6',
                                                padding: '12px',
                                                backdropFilter: 'blur(12px)',
                                            }}
                                            itemStyle={{ fontWeight: 600 }}
                                        />
                                        <Bar dataKey="caloriesIn" fill="url(#colorIn)" radius={[4, 4, 4, 4]} barSize={12} animationDuration={1500} />
                                        <Bar dataKey="caloriesOut" fill="url(#colorOut)" radius={[4, 4, 4, 4]} barSize={12} animationDuration={1500} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </LiquidGlassCard>
                    </div>

                    {/* Today's Target (Diet Plan) */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <LiquidGlassCard className="p-8 group h-full">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-teal-400"></div>
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-bold text-white">{t.todays_target}</h3>
                                <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                                    {t.planned}
                                </div>
                            </div>

                            <div className="relative mb-4 text-center">
                                <div className="flex items-baseline justify-center">
                                    <span className="text-5xl font-black text-white drop-shadow-md">
                                        {plannedCalories.toFixed(0)}
                                    </span>
                                    <span className="text-lg text-gray-400 font-medium ml-2">kcal</span>
                                </div>
                                <p className="text-sm text-gray-500 mt-2 font-medium uppercase tracking-wide">{t.total_planned}</p>
                            </div>
                            <div className="h-2 w-full bg-gray-700/50 rounded-full overflow-hidden mt-4">
                                <div className="h-full bg-emerald-500 w-3/4 animate-pulse rounded-full"></div>
                            </div>
                        </LiquidGlassCard>

                        {/* Target List */}
                        <LiquidGlassCard className="p-6 flex-grow flex flex-col h-[400px]">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                {t.planned_meals}
                            </h3>
                            {targetFoods.length > 0 ? (
                                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-grow">
                                    {targetFoods.map((food, index) => (
                                        <div key={index} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group border-l-2 border-l-emerald-500">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-200 group-hover:text-emerald-300 transition-colors text-sm">{food.name}</span>
                                            </div>
                                            <span className="font-bold text-emerald-400 text-sm">
                                                {food.calories.toFixed(0)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 border border-dashed border-white/10 rounded-2xl bg-white/5">
                                    <p className="text-sm font-medium">{t.no_meals}</p>
                                </div>
                            )}
                        </LiquidGlassCard>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
