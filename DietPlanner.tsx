
import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { DietPlan, MealOption } from '../types';
import { generateDietPlan } from '../services/geminiService';
import { HEALTH_ISSUES, DIETARY_PREFERENCES, ICONS, LANGUAGES } from '../constants';
import LoadingSpinner from '../components/LoadingSpinner';
import { DietPlanSkeleton } from '../components/Skeletons';
import { getErrorMessage } from '../utils/helpers';
import NearbyDoctors from '../components/NearbyDoctors';

// Moved outside to prevent re-renders
const SpeechButton: React.FC<{ textToSpeak: string; title: string; selectedLanguage: string }> = ({ textToSpeak, title, selectedLanguage }) => {
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
            const langCode = langCodeMap[selectedLanguage] || 'en-US';

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
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none transition-colors"
            aria-label={isSpeaking ? `Stop reading ${title}` : `Read ${title} aloud`}
        >
            {isSpeaking ? ICONS.speakerOff : ICONS.speaker}
        </button>
    );
};

const DietPlanner: React.FC = () => {
    const { user, dietPlan, setDietPlan, navigateTo, addFoodItems, dailyLog, removeFoodItem } = useAppContext();
    const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
    const [pregnancyMonth, setPregnancyMonth] = useState('');
    const [otherIssues, setOtherIssues] = useState('');
    const [preexistingConditions, setPreexistingConditions] = useState('');
    const [allergies, setAllergies] = useState('');
    const [dietaryPreference, setDietaryPreference] = useState(DIETARY_PREFERENCES[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState('English');

    const handleIssueToggle = (issue: string) => {
        setSelectedIssues(prev =>
            prev.includes(issue) ? prev.filter(i => i !== issue) : [...prev, issue]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            setError('User profile not found.');
            return;
        }
        setIsLoading(true);
        setError('');
        setDietPlan(null);

        const healthData = {
            healthIssues: selectedIssues,
            pregnancyMonth: selectedIssues.includes('Pregnancy') ? pregnancyMonth : undefined,
            otherHealthIssues: otherIssues,
            preexistingMedicalConditions: preexistingConditions,
            foodAllergies: allergies,
            dietaryPreference,
        };

        try {
            const plan = await generateDietPlan(user, healthData, selectedLanguage);
            setDietPlan(plan);
        } catch (err) {
            setError(`Failed to generate diet plan. ${getErrorMessage(err)}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

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
                        <li key={i} className={`group relative flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-xl transition-all duration-200 border ${isSelected ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-700/30 border-transparent hover:border-gray-200 dark:hover:border-gray-600'}`}>
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
                    <SpeechButton title={title} textToSpeak={textToSpeak} selectedLanguage={selectedLanguage} />
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
                ) : <p className="text-sm text-gray-500 dark:text-gray-400 italic">No specific information.</p>}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="max-w-5xl mx-auto p-4 md:p-8">
                <LoadingSpinner message="Designing your personalized nutrition plan..." />
                <div className="opacity-25 pointer-events-none filter blur-sm transition-all duration-700">
                    <DietPlanSkeleton />
                </div>
            </div>
        );
    }

    if (dietPlan) {
        return (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in px-2 sm:px-0">
                <div className="flex flex-col md:flex-row justify-between items-end border-b border-gray-200 dark:border-gray-700 pb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Your Diet Plan</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Tailored to your health profile and preferences.</p>
                    </div>
                    <button
                        onClick={() => setDietPlan(null)}
                        className="mt-4 md:mt-0 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline flex items-center"
                    >
                        {ICONS.edit} <span className="ml-1">Modify Constraints</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MealCard title="Breakfast" options={dietPlan.mealPlan?.breakfast || []} />
                    <MealCard title="Lunch" options={dietPlan.mealPlan?.lunch || []} />
                    <MealCard title="Snacks" options={dietPlan.mealPlan?.snacks || []} />
                    <MealCard title="Dinner" options={dietPlan.mealPlan?.dinner || []} />
                </div>

                {dietPlan.reasoning && (
                    <div className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 border border-blue-100 dark:border-blue-800/50 p-6 rounded-2xl shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xl font-bold text-blue-800 dark:text-blue-300 flex items-center">
                                <span className="mr-2">{ICONS.lightbulb}</span> Insight
                            </h3>
                            <SpeechButton title="Diet Plan Insight" textToSpeak={dietPlan.reasoning} selectedLanguage={selectedLanguage} />
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm md:text-base">{dietPlan.reasoning}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ListCard title="Foods to Include" items={dietPlan.foodsToInclude} />
                    <ListCard title="Foods to Avoid" items={dietPlan.foodsToAvoid} />
                    <ListCard title="Health Recommendations" items={dietPlan.healthRecommendations} />
                    <ListCard title="Precautions & Tips" items={dietPlan.precautions} />
                    <ListCard title="Lifestyle Modifications" items={dietPlan.lifestyleModifications} />
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-2xl border border-purple-100 dark:border-purple-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-purple-900 dark:text-purple-300 mb-1">Complement Your Diet</h3>
                        <p className="text-sm text-purple-700 dark:text-purple-400">We've also prepared some exercise recommendations for you.</p>
                    </div>
                    <button onClick={() => navigateTo('EXERCISE_CORNER')} className="px-6 py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:bg-purple-700 transition-transform transform hover:-translate-y-0.5">
                        View Workout Plan
                    </button>
                </div>
                <NearbyDoctors searchType="general" title="Nearby Dietitians & Nutrition Clinics" />
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 p-6 md:p-10 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 animate-fade-in-up">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-4">
                    {ICONS.diet}
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Create Your Diet Plan</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">Tell us about your needs, and our AI will craft the perfect meal plan.</p>
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

                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wider">Health Issues</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {HEALTH_ISSUES.map(issue => {
                            const isSelected = selectedIssues.includes(issue);
                            return (
                                <div
                                    key={issue}
                                    onClick={() => handleIssueToggle(issue)}
                                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex items-center space-x-3 ${isSelected ? 'bg-green-50 border-green-500 dark:bg-green-900/20 dark:border-green-500 shadow-md' : 'bg-gray-50 border-transparent hover:border-gray-200 dark:bg-gray-700/50 dark:hover:border-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 rounded flex items-center justify-center border ${isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800'}`}>
                                        {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                    </div>
                                    <span className={`font-medium ${isSelected ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>{issue}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Other Health Issues</label>
                    <textarea
                        value={otherIssues}
                        onChange={e => setOtherIssues(e.target.value)}
                        rows={2}
                        className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none text-gray-900 dark:text-white"
                        placeholder="Any specific conditions not listed above..."
                    ></textarea>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/30 p-6 rounded-2xl space-y-6">
                    {selectedIssues.includes('Pregnancy') && (
                        <div className="animate-fade-in">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Pregnancy Progress</label>
                            <input type="number" placeholder="Months" value={pregnancyMonth} onChange={e => setPregnancyMonth(e.target.value)} className="block w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Language Preference</label>
                            <div className="relative">
                                <select value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)} className="block w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all appearance-none cursor-pointer">
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
                                <select value={dietaryPreference} onChange={e => setDietaryPreference(e.target.value)} className="block w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all appearance-none cursor-pointer">
                                    {DIETARY_PREFERENCES.map(pref => <option key={pref} value={pref}>{pref}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Food Allergies</label>
                        <input type="text" placeholder="e.g., Peanuts, Shellfish, Lactose" value={allergies} onChange={e => setAllergies(e.target.value)} className="block w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Pre-existing Conditions</label>
                        <textarea value={preexistingConditions} onChange={e => setPreexistingConditions(e.target.value)} rows={2} className="block w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none" placeholder="Medical history..."></textarea>
                    </div>
                </div>

                <button type="submit" className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-teal-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-green-500/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                    Generate Personalized Plan
                </button>
            </form>
        </div>
    );
};

export default DietPlanner;
