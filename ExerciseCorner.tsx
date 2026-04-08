
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Exercise, WorkoutRoutine, SingleExerciseInfo } from '../types';
import { generateExerciseRoutine, generateSingleExerciseInfo } from '../services/geminiService';
import { EXERCISE_HEALTH_ISSUES, EXERCISE_LEVELS, ICONS } from '../constants';
import LoadingSpinner from '../components/LoadingSpinner';
import { ExerciseSkeleton } from '../components/Skeletons';
import NearbyDoctors from '../components/NearbyDoctors';
import { getErrorMessage } from '../utils/helpers';
import ExerciseFormMonitor from './ExerciseFormMonitor';
import YogaPoseDetector from './YogaPoseDetector';

const SingleExerciseVisualizer: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [exerciseInfo, setExerciseInfo] = useState<SingleExerciseInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Please enter an exercise name.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setExerciseInfo(null);
        try {
            const result = await generateSingleExerciseInfo(prompt);
            setExerciseInfo(result);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mt-6 bg-gray-50 dark:bg-gray-800/50 p-4 md:p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="space-y-4">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., Kettlebell Swing"
                    rows={1}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                >
                    {isLoading ? 'Generating Guide...' : 'Generate Exercise Guide'}
                </button>
            </div>
            <div className="mt-6 min-h-[300px] bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center p-4">
                {isLoading && <LoadingSpinner message="Creating your exercise guide..." />}
                {error && <p className="text-red-500 text-center">{error}</p>}
                {exerciseInfo && (
                    <div className="w-full text-left p-2 md:p-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-gray-200 dark:border-gray-600 pb-4">
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 capitalize">{exerciseInfo.name}</h3>
                            <a
                                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(exerciseInfo.youtubeQuery)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 sm:mt-0 inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                            >
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg>
                                Watch Tutorial
                            </a>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="font-bold text-lg text-gray-700 dark:text-gray-200 mb-3 flex items-center">
                                    <span className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mr-2 text-sm">1</span>
                                    Steps
                                </h4>
                                <ol className="space-y-3">
                                    {exerciseInfo.steps.map((step, i) => (
                                        <li key={i} className="flex items-start text-gray-600 dark:text-gray-300">
                                            <span className="mr-2 mt-1.5 w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></span>
                                            <span>{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                            <div>
                                <h4 className="font-bold text-lg text-gray-700 dark:text-gray-200 mb-3 flex items-center">
                                    <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-2 text-sm">!</span>
                                    Tips
                                </h4>
                                <ul className="space-y-3">
                                    {exerciseInfo.tips.map((tip, i) => (
                                        <li key={i} className="flex items-start text-gray-600 dark:text-gray-300">
                                            <span className="mr-2 mt-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></span>
                                            <span>{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
                {!isLoading && !error && !exerciseInfo && (
                    <p className="text-gray-500 dark:text-gray-400">Your generated guide will appear here.</p>
                )}
            </div>
        </div>
    );
};


const ExerciseCard: React.FC<{ exercise: Exercise; onLog: (calories: number, name: string) => void; healthIssues: string[] }> = ({ exercise, onLog, healthIssues }) => {
    const [setsCompleted, setSetsCompleted] = useState(exercise.sets || 1);
    const [isLogged, setIsLogged] = useState(false);

    const handleLog = () => {
        const totalCalories = exercise.caloriesBurnedPerSet * setsCompleted;
        onLog(totalCalories, exercise.name);
        setIsLogged(true);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow duration-200">
            <div className="p-5 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 leading-tight">{exercise.name}</h3>
                    <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.youtubeQuery)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors flex-shrink-0 ml-2"
                        title="Watch on YouTube"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg>
                    </a>
                </div>

                <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                    <div className="flex items-center">
                        <span className="font-bold text-gray-900 dark:text-white mr-1">{exercise.sets}</span> sets
                    </div>
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                    <div className="flex items-center">
                        <span className="font-bold text-gray-900 dark:text-white mr-1">{exercise.reps}</span> reps
                    </div>
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                    <div className="flex items-center">
                        <span className="font-bold text-gray-900 dark:text-white mr-1">~{(exercise.caloriesBurnedPerSet * (exercise.sets || 1)).toFixed(0)}</span> kcal
                    </div>
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400 flex-grow mb-4 space-y-3">
                    <div>
                        <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-1">Instructions:</h4>
                        <ol className="list-decimal list-inside space-y-1 pl-1 marker:text-gray-400">
                            {exercise.steps.slice(0, 3).map((step, i) => <li key={i} className="line-clamp-2">{step}</li>)}
                        </ol>
                        {exercise.steps.length > 3 && <p className="text-xs text-gray-400 mt-1 pl-4 italic">...and more</p>}
                    </div>
                </div>

                {exercise.modifications && exercise.modifications.length > 0 && (
                    <details className="mb-3 text-xs">
                        <summary className="cursor-pointer font-semibold text-gray-600 dark:text-gray-300 hover:text-green-600 transition-colors">Modifications</summary>
                        <ul className="list-disc list-inside pl-4 mt-1 text-gray-500 dark:text-gray-400">
                            {exercise.modifications.map((mod, i) => <li key={i}>{mod}</li>)}
                        </ul>
                    </details>
                )}
                <details className="mb-4 text-xs">
                    <summary className="cursor-pointer font-semibold text-gray-600 dark:text-gray-300 hover:text-green-600 transition-colors">Coach's Tip</summary>
                    <p className="mt-1 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-100 dark:border-yellow-900/30 text-gray-600 dark:text-gray-400 italic">"{exercise.videoScript}"</p>
                </details>

                <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-2">Log your completed sets:</p>
                    <div className="flex items-center justify-center space-x-2 mb-3">
                        <button onClick={() => setSetsCompleted(s => Math.max(1, s - 1))} className="px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-500" disabled={isLogged}>-</button>
                        <input type="number" value={setsCompleted} onChange={(e) => setSetsCompleted(parseInt(e.target.value) || 1)} className="w-12 text-center bg-transparent border-b border-gray-300 dark:border-gray-600 dark:text-white focus:outline-none focus:border-green-500" disabled={isLogged} />
                        <button onClick={() => setSetsCompleted(s => s + 1)} className="px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-500" disabled={isLogged}>+</button>
                    </div>
                    <button
                        onClick={handleLog}
                        className="w-full py-2 px-4 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 bg-green-600 hover:bg-green-700"
                        disabled={isLogged}
                    >
                        {isLogged ? 'Logged ✔' : `Log Activity (~${(exercise.caloriesBurnedPerSet * setsCompleted).toFixed(0)} kcal)`}
                    </button>
                </div>
            </div>
        </div>
    );
};

const WorkoutRoutineGenerator: React.FC = () => {
    const { user, addCaloriesOut, navigateTo } = useAppContext();
    const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
    const [trimester, setTrimester] = useState('');
    const [level, setLevel] = useState(EXERCISE_LEVELS[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [routine, setRoutine] = useState<WorkoutRoutine | null>(null);
    const [loggedExercises, setLoggedExercises] = useState<string[]>([]);

    const totalExercises = routine ? (routine.warmUp?.length || 0) + (routine.mainWorkout?.length || 0) + (routine.coolDown?.length || 0) : 0;
    const progress = totalExercises > 0 ? (loggedExercises.length / totalExercises) * 100 : 0;

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
        setRoutine(null);
        setLoggedExercises([]);

        const exerciseData = {
            healthIssues: selectedIssues,
            trimester: selectedIssues.includes('Pregnant') ? trimester : undefined,
            preference: level,
        };

        try {
            const result = await generateExerciseRoutine(user, exerciseData);
            setRoutine(result);
        } catch (err) {
            setError(`Failed to generate exercise routine. ${getErrorMessage(err)} Please try again.`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogExercise = (calories: number, name: string) => {
        addCaloriesOut(calories);
        setLoggedExercises(prev => [...prev, name]);
        alert(`${calories.toFixed(0)} calories burned from ${name} have been logged!`);
    };

    if (isLoading) {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-center md:justify-start space-x-3 mb-6 text-green-600 dark:text-green-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div>
                    <p className="text-lg font-semibold">Curating your expert workout plan...</p>
                </div>
                <ExerciseSkeleton />
            </div>
        );
    }

    if (routine) {
        return (
            <div className="space-y-8 animate-fade-in">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md sticky top-[70px] z-10 border border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">Your Custom Workout</h2>
                    <div className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                        <span>Progress</span>
                        <span>{loggedExercises.length} / {totalExercises} exercises</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                    {progress === 100 && (
                        <p className="text-center text-green-600 dark:text-green-400 font-semibold mt-2">Workout Complete! Great job!</p>
                    )}
                </div>

                <WorkoutSection title="Warm-up" exercises={routine.warmUp} onLog={handleLogExercise} healthIssues={selectedIssues} />
                <WorkoutSection title="Main Workout" exercises={routine.mainWorkout} onLog={handleLogExercise} healthIssues={selectedIssues} />
                <WorkoutSection title="Cool-down" exercises={routine.coolDown} onLog={handleLogExercise} healthIssues={selectedIssues} />

                <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4 mt-8">
                    <button onClick={() => setRoutine(null)} className="py-2 px-6 bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:bg-gray-600">
                        Generate New Workout
                    </button>
                    <button onClick={() => navigateTo('TODAYS_GOAL')} className="py-2 px-6 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">
                        View Today's Goal
                    </button>
                </div>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && <p className="text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-lg">{error}</p>}

            <div>
                <label className="block text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Any Health Constraints?</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {EXERCISE_HEALTH_ISSUES.map(issue => (
                        <label key={issue} className={`flex items-center space-x-2 p-3 rounded-lg cursor-pointer border-2 ${selectedIssues.includes(issue) ? 'bg-green-100 border-green-400 dark:bg-green-900/50 dark:border-green-600' : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'}`}>
                            <input type="checkbox" checked={selectedIssues.includes(issue)} onChange={() => handleIssueToggle(issue)} className="form-checkbox h-5 w-5 text-green-600 rounded" />
                            <span className="dark:text-gray-300">{issue}</span>
                        </label>
                    ))}
                </div>
            </div>

            {selectedIssues.includes('Pregnant') && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Which trimester?</label>
                    <select value={trimester} onChange={e => setTrimester(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-100">
                        <option value="">Select</option>
                        <option value="1st">1st Trimester</option>
                        <option value="2nd">2nd Trimester</option>
                        <option value="3rd">3rd Trimester</option>
                    </select>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Exercise Preference</label>
                <select value={level} onChange={e => setLevel(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-100">
                    {EXERCISE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
            </div>

            <button type="submit" className="w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">
                Generate Workout
            </button>
        </form>
    );
}

const WorkoutSection: React.FC<{ title: string, exercises: Exercise[], onLog: (calories: number, name: string) => void, healthIssues: string[] }> = ({ title, exercises, onLog, healthIssues }) => {
    if (!exercises || exercises.length === 0) return null;
    return (
        <div>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 border-b-2 border-green-500 pb-2">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exercises.map((ex, index) => (
                    <ExerciseCard key={index} exercise={ex} onLog={onLog} healthIssues={healthIssues} />
                ))}
            </div>
        </div>
    );
};

const ExerciseCorner: React.FC = () => {
    const [mode, setMode] = useState<'plan' | 'visualize' | 'monitor' | 'yoga'>('plan');

    return (
        <div className="max-w-6xl mx-auto bg-white dark:bg-gray-800 p-4 md:p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 animate-fade-in-up">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Exercise Corner</h2>

            <div className="flex flex-col sm:flex-row border-b border-gray-200 dark:border-gray-700 mb-6">
                <button
                    onClick={() => setMode('plan')}
                    className={`flex items-center space-x-2 px-4 py-3 text-lg font-semibold border-b-2 transition-colors ${mode === 'plan' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    {ICONS.dumbbell}
                    <span>Get a Full Workout</span>
                </button>
                <button
                    onClick={() => setMode('visualize')}
                    className={`flex items-center space-x-2 px-4 py-3 text-lg font-semibold border-b-2 transition-colors ${mode === 'visualize' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                    <span>Find a Tutorial</span>
                </button>
                <button
                    onClick={() => setMode('monitor')}
                    className={`flex items-center space-x-2 px-4 py-3 text-lg font-semibold border-b-2 transition-colors ${mode === 'monitor' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" /><rect x="3" y="6" width="12" height="12" rx="2" ry="2" /></svg>
                    <span>AI Form Monitor</span>
                </button>
                <button
                    onClick={() => setMode('yoga')}
                    className={`flex items-center space-x-2 px-4 py-3 text-lg font-semibold border-b-2 transition-colors ${mode === 'yoga' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M6.5 16c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"/><path d="M3 21c0-2.5 2-4 4.5-4h9c2.5 0 4.5 1.5 4.5 4"/></svg>
                    <span>AI Yoga Guru</span>
                </button>
            </div>

            {mode === 'plan' && <WorkoutRoutineGenerator />}
            {mode === 'visualize' && <SingleExerciseVisualizer />}
            {mode === 'monitor' && <ExerciseFormMonitor />}
            {mode === 'yoga' && <YogaPoseDetector />}
            {mode !== 'yoga' && <NearbyDoctors searchType="general" title="Nearby Gyms &amp; Sports Medicine Specialists" />}
        </div>
    );
};

export default ExerciseCorner;
