
import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { ReportAnalysis, MealOption } from '../types';
import { analyzeMedicalReport } from '../services/geminiService';
import { getErrorMessage } from '../utils/helpers';
import { fileToBase64 } from '../services/helpers';
import { DIETARY_PREFERENCES, ICONS, LANGUAGES } from '../constants';
import LoadingSpinner from '../components/LoadingSpinner';
import { ReportSkeleton } from '../components/Skeletons';
import Chatbot from '../components/Chatbot';
import NearbyDoctors from '../components/NearbyDoctors';

// Moved outside to prevent re-renders
const SpeechButton: React.FC<{ textToSpeak: string; title: string; language: string }> = ({ textToSpeak, title, language }) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        const handleVoicesChanged = () => {
            setVoices(window.speechSynthesis.getVoices());
        };
        window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
        handleVoicesChanged(); // Initial load

        const u = new SpeechSynthesisUtterance();
        utteranceRef.current = u;
        u.onstart = () => setIsSpeaking(true);
        u.onend = () => setIsSpeaking(false);
        u.onerror = (e) => {
            if (e.error !== 'interrupted') {
                console.error("Speech synthesis error:", e.error);
            }
            setIsSpeaking(false);
        };

        return () => {
            window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
            window.speechSynthesis.cancel();
        };
    }, []);

    const handleToggleSpeech = () => {
        if (!utteranceRef.current) return;

        if (isSpeaking) {
            window.speechSynthesis.cancel();
        } else {
            window.speechSynthesis.cancel(); // Stop any other speech
            const fullText = `${title}. ${textToSpeak}`;
            utteranceRef.current.text = fullText;

            const langCodeMap: { [key: string]: string } = {
                'English': 'en-US', 'Hindi': 'hi-IN', 'Kannada': 'kn-IN', 'Tamil': 'ta-IN',
                'Telugu': 'te-IN', 'Bengali': 'bn-IN', 'Marathi': 'mr-IN', 'Gujarati': 'gu-IN'
            };
            const langCode = langCodeMap[language] || 'en-US';

            utteranceRef.current.lang = langCode;
            const bestVoice = voices.find(v => v.lang === langCode) || voices.find(v => v.lang.startsWith(langCode.split('-')[0]));

            if (bestVoice) {
                utteranceRef.current.voice = bestVoice;
            } else {
                utteranceRef.current.voice = null;
            }

            window.speechSynthesis.speak(utteranceRef.current);
        }
    };

    return (
        <button
            onClick={handleToggleSpeech}
            className="p-2 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            aria-label={isSpeaking ? `Stop reading ${title}` : `Read ${title} aloud`}
        >
            {isSpeaking ? ICONS.speakerOff : ICONS.speaker}
        </button>
    );
};

const ReportAnalyzer: React.FC = () => {
    const { user, reportAnalysis, setReportAnalysis, navigateTo, addFoodItems, dailyLog, removeFoodItem } = useAppContext();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [dietaryPreference, setDietaryPreference] = useState(DIETARY_PREFERENCES[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState('English');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            if (selectedFile.type.startsWith('image/')) {
                setPreview(URL.createObjectURL(selectedFile));
            } else {
                setPreview(null); // No preview for non-image files
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !file) {
            setError('Please upload a report and ensure you are logged in.');
            return;
        }
        setIsLoading(true);
        setError('');
        setReportAnalysis(null);

        try {
            const base64Data = await fileToBase64(file);
            const analysis = await analyzeMedicalReport(user, dietaryPreference, base64Data, file.type, selectedLanguage);
            setReportAnalysis(analysis);
        } catch (err) {
            setError(`Failed to analyze report. ${getErrorMessage(err)} Please try again with a clear document.`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const AnalysisDisplay: React.FC<{ analysis: ReportAnalysis; language: string }> = ({ analysis, language }) => {
        const { user } = useAppContext();

        const handleToggleMeal = (meal: MealOption) => {
            const existingItem = dailyLog.loggedFoods.find(
                food => food.name === meal.name && food.calories === meal.calories && food.source === 'plan'
            );

            if (existingItem) {
                removeFoodItem(existingItem);
            } else {
                addFoodItems([{ name: meal.name, calories: meal.calories }], 'plan');
            }
        };

        const MealCard: React.FC<{ title: string, options: MealOption[] }> = ({ title, options }) => (
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow duration-200">
                <h4 className="font-bold text-lg text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">{title}</h4>
                <ul className="space-y-3">
                    {(options || []).map((opt, i) => {
                        const isSelected = dailyLog.loggedFoods.some(food => food.name === opt.name && food.calories === opt.calories && food.source === 'plan');
                        return (
                            <li key={i} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-xl transition-all duration-200 border ${isSelected ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-700/30 border-transparent hover:border-gray-200 dark:hover:border-gray-600'}`}>
                                <div className="flex-grow pr-4">
                                    <div className="flex items-center">
                                        <span className={`font-semibold ${isSelected ? 'text-green-800 dark:text-green-300' : 'text-gray-800 dark:text-gray-200'}`}>{opt.name}</span>
                                        {isSelected && <span className="ml-2 text-green-600 dark:text-green-400 text-xs">{ICONS.checkCircle}</span>}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">{opt.description}</p>
                                    <span className="inline-block mt-1 text-xs font-medium text-gray-400 dark:text-gray-500">{opt.calories} kcal</span>
                                </div>
                                <button
                                    onClick={() => handleToggleMeal(opt)}
                                    className={`mt-2 sm:mt-0 flex-shrink-0 text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-200 shadow-sm ${isSelected ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40' : 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500'}`}
                                >
                                    {isSelected ? 'Remove' : 'Add'}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );

        const ListCard: React.FC<{ title: string, items: string[] }> = ({ title, items }) => {
            const textToSpeak = items && items.length > 0 ? items.join('. ') : "No information provided.";
            return (
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-green-700 dark:text-green-400">{title}</h4>
                        <SpeechButton title={title} textToSpeak={textToSpeak} language={language} />
                    </div>
                    {items && items.length > 0 ? (
                        <ul className="space-y-2 text-gray-600 dark:text-gray-300 text-sm">
                            {items.map((item, i) => (
                                <li key={i} className="flex items-start">
                                    <span className="mr-2 text-green-500 mt-1">•</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-gray-500 dark:text-gray-400 italic">No information provided.</p>}
                </div>
            );
        };

        const patientInfoText = `Patient Name: ${analysis.patientInfo.name}. Age: ${analysis.patientInfo.age}. Gender: ${analysis.patientInfo.gender}. Report Date: ${analysis.patientInfo.reportDate}.`;

        return (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in px-2 sm:px-0">
                <div className="flex flex-col md:flex-row justify-between items-end border-b border-gray-200 dark:border-gray-700 pb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Report Analysis</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">AI-generated insights from your medical document.</p>
                    </div>
                    <button
                        onClick={() => setReportAnalysis(null)}
                        className="mt-4 md:mt-0 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline flex items-center"
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Analyze Another Report
                    </button>
                </div>

                {/* Patient Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div className="flex justify-between items-center mb-4 relative z-10">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                            <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3">
                                {ICONS.user}
                            </span>
                            Patient Details
                        </h3>
                        <SpeechButton title="Patient Information" textToSpeak={patientInfoText} language={language} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm relative z-10">
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider mb-1">Name</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{analysis.patientInfo.name}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider mb-1">Age</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{analysis.patientInfo.age}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider mb-1">Gender</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{analysis.patientInfo.gender}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider mb-1">Date</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{analysis.patientInfo.reportDate}</p>
                        </div>
                    </div>
                </div>

                {analysis.actionPlan && analysis.actionPlan.length > 0 && (
                    <div className="bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 border border-green-200 dark:border-green-800/50 p-6 rounded-2xl shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-green-900 dark:text-green-300">Priority Action Plan</h3>
                            <SpeechButton title="Your Action Plan" textToSpeak={analysis.actionPlan.join('. ')} language={language} />
                        </div>
                        <ul className="space-y-3">
                            {analysis.actionPlan.map((item, index) => (
                                <li key={index} className="flex items-start bg-white/60 dark:bg-gray-900/40 p-3 rounded-xl">
                                    <span className="text-green-600 dark:text-green-400 mt-0.5 mr-3 flex-shrink-0 bg-green-100 dark:bg-green-900/50 rounded-full p-0.5">{ICONS.checkCircle}</span>
                                    <span className="text-gray-800 dark:text-gray-200 font-medium">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Summary</h3>
                            <SpeechButton title="Report Summary" textToSpeak={analysis.reportSummary} language={language} />
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">{analysis.reportSummary}</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Explanation</h3>
                            <SpeechButton title="Problem Explanation" textToSpeak={analysis.problemExplanation} language={language} />
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">{analysis.problemExplanation}</p>
                    </div>
                </div>

                <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                        <span className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center mr-3 text-sm">
                            {ICONS.diet}
                        </span>
                        Dietary Recommendations
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <MealCard title="Breakfast" options={analysis.mealPlan?.breakfast || []} />
                        <MealCard title="Lunch" options={analysis.mealPlan?.lunch || []} />
                        <MealCard title="Snacks" options={analysis.mealPlan?.snacks || []} />
                        <MealCard title="Dinner" options={analysis.mealPlan?.dinner || []} />
                    </div>
                    {analysis.reasoning && (
                        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 p-6 rounded-2xl">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-lg font-bold text-blue-900 dark:text-blue-300">Why this plan?</h4>
                                <SpeechButton title="Diet Plan Reasoning" textToSpeak={analysis.reasoning} language={language} />
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">{analysis.reasoning}</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ListCard title="Foods to Include" items={analysis.foodsToInclude} />
                    <ListCard title="Foods to Avoid" items={analysis.foodsToAvoid} />
                    <ListCard title="Treatment Ideas" items={analysis.treatmentRecommendations} />
                    <ListCard title="Key Recommendations" items={analysis.keyRecommendations} />
                    <ListCard title="Precautions" items={analysis.precautions} />
                    <ListCard title="Lifestyle Changes" items={analysis.lifestyleModifications} />
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Recommended Exercises</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Tailored movement based on your report.</p>
                        </div>
                        <button onClick={() => navigateTo('EXERCISE_CORNER')} className="px-6 py-3 bg-gray-900 dark:bg-gray-700 text-white font-bold rounded-xl shadow-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors">
                            View Exercise Guide
                        </button>
                    </div>
                    {analysis.exerciseRoutine && analysis.exerciseRoutine.length > 0 ? (
                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {analysis.exerciseRoutine.map((ex, i) => (
                                <div key={i} className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">{ex.name}</p>
                                </div>
                            ))}
                        </div>
                    ) : <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">No specific exercises recommended based on this report.</p>}
                </div>

                {/* Embedded Chatbot Section */}
                <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {user && (
                        <div className="h-[600px]">
                            <Chatbot
                                isOpen={true}
                                onClose={() => { }}
                                user={user}
                                contextData={{ reportAnalysis: analysis }}
                                language={selectedLanguage}
                                setLanguage={setSelectedLanguage}
                                mode="report"
                                isEmbedded={true}
                            />
                        </div>
                    )}
                </div>
                <NearbyDoctors searchType="general" title="Nearby Doctors & Specialist Clinics" />
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="max-w-5xl mx-auto p-4 md:p-8">
                <LoadingSpinner message="Analyzing your medical report..." />
                <div className="opacity-25 pointer-events-none filter blur-sm transition-all duration-700">
                    <ReportSkeleton />
                </div>
            </div>
        );
    }

    if (reportAnalysis) return <AnalysisDisplay analysis={reportAnalysis} language={selectedLanguage} />;

    return (
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 p-6 md:p-10 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 animate-fade-in-up">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4">
                    {ICONS.report}
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Medical Report Analyzer</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">Upload your report for an instant AI-powered summary and advice.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {error && (
                    <div className="flex items-start p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-100 dark:border-red-800">
                        <div className="flex-shrink-0 text-red-500 dark:text-red-400">
                            {ICONS.warning}
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
                        </div>
                    </div>
                )}

                <div className="group">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Upload Document</label>
                    <label
                        htmlFor="file-upload"
                        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${file ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-green-400'}`}
                    >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {preview ? (
                                <img src={preview} alt="Report preview" className="h-48 w-auto object-contain rounded-lg shadow-sm" />
                            ) : file ? (
                                <div className="text-center p-4">
                                    <div className="w-16 h-16 mx-auto bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm mb-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">{file.name}</p>
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">Click to change</p>
                                </div>
                            ) : (
                                <>
                                    <div className="w-16 h-16 mx-auto bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform duration-300">
                                        <svg className="w-8 h-8 text-gray-400 dark:text-gray-500 group-hover:text-green-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                    </div>
                                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500">SVG, PNG, JPG or PDF (MAX. 10MB)</p>
                                </>
                            )}
                        </div>
                        <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/*,application/pdf" />
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Language</label>
                        <div className="relative">
                            <select value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)} className="block w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer">
                                {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Dietary Preference</label>
                        <div className="relative">
                            <select value={dietaryPreference} onChange={e => setDietaryPreference(e.target.value)} className="block w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer">
                                {DIETARY_PREFERENCES.map(pref => <option key={pref} value={pref}>{pref}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>
                </div>

                <button type="submit" disabled={!file} className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none transition-all duration-200">
                    Analyze Report
                </button>
            </form>
        </div>
    );
};

export default ReportAnalyzer;
