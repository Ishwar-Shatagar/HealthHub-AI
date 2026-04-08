
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { ICONS } from '../constants';
import { calculateMaintenanceCalories } from '../services/helpers';

const TodaysGoal: React.FC = () => {
    const { dailyLog, user, navigateTo } = useAppContext();
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    // Create a stable utterance object and load voices
    useEffect(() => {
        const u = new SpeechSynthesisUtterance();
        setUtterance(u);

        const handleVoicesChanged = () => {
            setVoices(speechSynthesis.getVoices());
        };

        speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
        handleVoicesChanged(); // Initial load attempt

        // Cleanup on component unmount
        return () => {
            speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
            speechSynthesis.cancel();
        };
    }, []);

    const maintenanceCalories = user ? calculateMaintenanceCalories(user) : 2000;
    const totalCaloriesEaten = dailyLog.caloriesIn;
    const caloriesBurned = dailyLog.caloriesOut;
    const netCalories = totalCaloriesEaten - caloriesBurned;

    const UNDERWEIGHT_THRESHOLD = 18.5;
    const OVERWEIGHT_THRESHOLD = 25;

    // 1. Determine Goal Type and Adjustment based on BMI
    let goalType = "Maintain Weight";
    let adjustment = 0;
    let description = "balance your intake with your activity.";

    if (user) {
        if (user.bmi >= OVERWEIGHT_THRESHOLD) {
            goalType = "Weight Loss";
            adjustment = -500; // Deficit for weight loss
            description = "achieve a healthy weight loss.";
        } else if (user.bmi < UNDERWEIGHT_THRESHOLD) {
            goalType = "Weight Gain";
            adjustment = 500; // Surplus for weight gain
            description = "gain weight healthily.";
        }
    }

    // 2. Calculate Dynamic Targets
    // Base goal = Maintenance (based on Age/Weight/Height) + Adjustment
    const dailyBaseGoal = maintenanceCalories + adjustment;

    // Total Target = Base Goal + Calories Burned (Net Calorie Approach)
    // This allows the user to eat more if they exercise, while sticking to the plan.
    const calorieGoal = dailyBaseGoal + caloriesBurned;

    const remaining = calorieGoal - totalCaloriesEaten;
    const isOverBudget = remaining < 0;

    // 3. Determine Advice Feedback
    let adviceText = "";
    let adviceColor = "blue";
    let adviceIcon = ICONS.checkCircle;

    if (remaining >= 0) {
        if (goalType === "Weight Gain") {
            adviceText = `Eat ${remaining.toFixed(0)} more calories to reach your weight gain goal.`;
            adviceColor = "green";
            adviceIcon = ICONS.flame;
        } else {
            adviceText = `You have ${remaining.toFixed(0)} calories left in your budget. Good job!`;
            adviceColor = "green";
            adviceIcon = ICONS.checkCircle;
        }
    } else {
        // Surplus (Over budget)
        const overAmount = Math.abs(remaining).toFixed(0);
        if (goalType === "Weight Gain") {
            adviceText = "Fantastic! You've hit your calorie surplus target for the day.";
            adviceColor = "blue";
            adviceIcon = ICONS.star;
        } else {
            adviceText = `You're ${overAmount} calories over limit. A workout could help balance this.`;
            adviceColor = "orange";
            adviceIcon = ICONS.dumbbell;
        }
    }

    const goalFeedback = {
        title: `Goal: ${goalType}`,
        // Explicitly mention Age and BMI in the summary
        summary: `Based on your Age (${user?.age}) and BMI (${user?.bmi}), your maintenance level is ${maintenanceCalories.toFixed(0)} kcal. We adjusted this by ${adjustment > 0 ? '+' : ''}${adjustment} kcal to help you ${description}`,
        calorieGoal: calorieGoal,
        actionableAdvice: {
            text: adviceText,
            color: adviceColor,
            icon: adviceIcon
        }
    };

    // Handle auto-speak effect based on derived data
    useEffect(() => {
        const adviceText = goalFeedback?.actionableAdvice?.text;

        if (!utterance || !adviceText || voices.length === 0) {
            return;
        }

        if (speechSynthesis.speaking && utterance.text === adviceText) {
            return;
        }

        speechSynthesis.cancel();

        utterance.text = adviceText;
        const femaleVoice = voices.find(v => v.lang.startsWith('en') && v.name.match(/female|woman|zira|susan/i));
        if (femaleVoice) {
            utterance.voice = femaleVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
            if (e.error !== 'interrupted') {
                console.error("Speech synthesis error:", e.error);
            }
            setIsSpeaking(false);
        };

    }, [utterance, voices, goalFeedback.actionableAdvice.text]);

    const handleToggleSpeech = () => {
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            if (utterance) {
                utterance.text = goalFeedback.actionableAdvice.text;
                speechSynthesis.speak(utterance);
            }
        }
    };

    const { title, summary, actionableAdvice } = goalFeedback;
    const progress = Math.max(0, (totalCaloriesEaten / calorieGoal) * 100);

    // Visualization logic for progress bar
    // If Weight Loss goal and over budget -> Red
    // If Weight Gain goal and under budget -> Yellow/Orange (needs more)
    // Otherwise Green
    let progressBarColor = 'bg-gradient-to-r from-green-400 to-green-600';
    if (isOverBudget && goalType !== "Weight Gain") {
        progressBarColor = 'bg-red-500';
    } else if (goalType === "Weight Gain" && progress < 100) {
        progressBarColor = 'bg-gradient-to-r from-yellow-400 to-orange-500';
    }

    const colorClasses = {
        green: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
        orange: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200',
        blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    Today's Goal Tracker
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Monitor your daily calorie balance and habits.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Snapshot (Intake, Progress, Stats) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                        Today's Intake
                        <span className="ml-auto text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                            Target: {calorieGoal.toFixed(0)}
                        </span>
                    </h3>

                    <div className="relative pt-2">
                        <div className="flex items-end justify-between mb-2">
                            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{totalCaloriesEaten.toFixed(0)}</span>
                            <span className="text-sm text-gray-500 mb-1">kcal</span>
                        </div>
                        {/* Progress Bar matching Dashboard */}
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                            <div
                                className={`h-4 rounded-full transition-all duration-1000 ease-out ${progressBarColor}`}
                                style={{ width: `${Math.min(100, progress)}%` }}
                            ></div>
                        </div>
                        <p className="text-right text-xs text-gray-400 mt-1">{progress.toFixed(0)}% of target</p>
                    </div>

                    {/* Stats Grid matching Dashboard */}
                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-800/30">
                            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Burned</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{caloriesBurned.toFixed(0)}</p>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Net</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{netCalories.toFixed(0)}</p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Advice Card */}
                <div className="bg-gray-100 dark:bg-gray-700/50 p-6 rounded-2xl border border-transparent dark:border-gray-700 flex flex-col">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed text-sm">{summary}</p>

                    <div className={`mt-auto p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-4 ${colorClasses[actionableAdvice.color as keyof typeof colorClasses]}`}>
                        <div className="p-2 bg-white/50 dark:bg-black/10 rounded-full">{actionableAdvice.icon}</div>
                        <div className="flex-grow">
                            <p className="font-semibold text-sm sm:text-base">{actionableAdvice.text}</p>
                        </div>
                        <button
                            onClick={handleToggleSpeech}
                            className="p-2 rounded-full hover:bg-white/20 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-white/50"
                        >
                            {isSpeaking ? ICONS.speakerOff : ICONS.speaker}
                        </button>
                    </div>
                </div>
            </div>

            {/* Logged Items List */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Logged Items Details</h3>
                {dailyLog.loggedFoods && dailyLog.loggedFoods.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {dailyLog.loggedFoods.map((food, index) => (
                            <div key={index} className="flex justify-between items-center text-sm p-3 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-100 dark:border-gray-700">
                                <div className="flex flex-col">
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{food.name}</span>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">{food.source}</span>
                                </div>
                                <span className="font-bold text-green-600 dark:text-green-400">{food.calories.toFixed(0)} kcal</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                        <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        <p className="text-sm">No food logged yet</p>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => navigateTo('CALORIE_COUNTER')} className="w-full py-4 px-4 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 hover:bg-green-700 hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center justify-center space-x-2">
                    {ICONS.flame}
                    <span>Log a Meal</span>
                </button>
                <button onClick={() => navigateTo('EXERCISE_CORNER')} className="w-full py-4 px-4 bg-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:bg-purple-700 hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center justify-center space-x-2">
                    {ICONS.dumbbell}
                    <span>Log a Workout</span>
                </button>
            </div>
        </div>
    );
};

export default TodaysGoal;
