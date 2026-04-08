import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { sendDailyReport } from '../services/emailService';
import { EQUIPMENT_LIST, EXERCISE_CATALOG } from '../constants/exercises';
import { CatalogExercise } from '../types';

import Model, { IExerciseData, IMuscleStats } from 'react-body-highlighter';

const BodyMap: React.FC<{ selectedMuscles: string[], onToggle: (muscle: string) => void }> = ({ selectedMuscles, onToggle }) => {

    // Mapping from our simple muscle names to react-body-highlighter slugs
    // Note: The library uses specific anatomical names.
    // Mapping from our simple muscle names to react-body-highlighter slugs
    // Using standard slugs commonly supported by the library to prevent crashes.
    // Mapping from our simple muscle names to react-body-highlighter slugs
    // Verified supported slugs to prevent crashes.
    const muscleMapping: { [key: string]: string[] } = {
        'Chest': ['chest'],
        'Back': ['upper-back', 'lower-back'],
        'Shoulders': ['front-deltoids', 'back-deltoids'],
        'Biceps': ['biceps'],
        'Triceps': ['triceps'],
        'Quads': ['quadriceps'],
        'Hamstrings': ['hamstring'],
        'Glutes': ['gluteal'],
        'Calves': ['calves'],
        'Core': ['abs', 'obliques'],
        'Forearms': ['forearm'],
        'Neck': ['neck']
    };

    // Reverse mapping to find our simple key from a slug click
    const findMuscleKey = (slug: string): string | undefined => {
        return Object.keys(muscleMapping).find(key => muscleMapping[key].includes(slug));
    };

    // Prepare data for the library
    const data: IExerciseData[] = selectedMuscles.map(muscle => {
        const slugs = muscleMapping[muscle] || [];
        return {
            name: muscle,
            muscles: slugs as any, // Cast to avoid specific Muscle union type issues
            frequency: 3
        };
    });

    const handleClick = ({ muscle }: IMuscleStats) => {
        // The library returns the slug clicked (e.g., 'chest')
        // We find which group it belongs to.
        const key = findMuscleKey(muscle);
        if (key) {
            onToggle(key);
        } else {
            console.log("Clicked unmapped muscle:", muscle);
            // Optimization: If the user clicks a valid muscle we don't have mapped, we could map it dynamically?
            // For now, let's just log it. 
        }
    };

    return (
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16 w-full">
            <div className="flex flex-col items-center">
                <p className="mb-4 text-gray-400 font-medium">Front View</p>
                <Model
                    data={data}
                    style={{ width: '200px', height: '400px' }}
                    type="anterior"
                    onClick={handleClick}
                    highlightedColors={['#3B82F6', '#2563EB']} // Blue shades
                />
            </div>
            <div className="flex flex-col items-center">
                <p className="mb-4 text-gray-400 font-medium">Back View</p>
                <Model
                    data={data}
                    style={{ width: '200px', height: '400px' }}
                    type="posterior"
                    onClick={handleClick}
                    highlightedColors={['#3B82F6', '#2563EB']}
                />
            </div>
        </div>
    );
};

// Helper types for Active Workout
interface WorkoutSet {
    id: string;
    reps: string;
    weight: string;
    completed: boolean;
    calories?: number;
}

interface WorkoutLog {
    [exerciseId: string]: WorkoutSet[];
}

// Simple CSS Confetti (injected style)
const ConfettiStyle = () => (
    <style>{`
        @keyframes confetti-fall {
            0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .confetti {
            position: fixed;
            width: 10px;
            height: 10px;
            background-color: #f00;
            animation: confetti-fall 3s linear forwards;
            top: -10px;
            z-index: 60;
        }
    `}</style>
);

// Sound Effects Helpers
const playBeep = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
        console.error("Audio error", e);
    }
};

const playFanfare = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        const playNote = (freq: number, time: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
            osc.start(time);
            osc.stop(time + duration);
        };

        const now = ctx.currentTime;
        playNote(523.25, now, 0.2); // C5
        playNote(659.25, now + 0.2, 0.2); // E5
        playNote(783.99, now + 0.4, 0.4); // G5
        playNote(1046.50, now + 0.8, 0.8); // C6
    } catch (e) {
        console.error("Audio error", e);
    }
};




const PlateCalculator: React.FC<{ isOpen: boolean; weight: number; onClose: () => void }> = ({ isOpen, weight, onClose }) => {
    if (!isOpen) return null;

    const barWeight = 20;
    const target = Math.max(0, weight - barWeight);
    const sideWeight = target / 2;

    const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
    const plateCounts: { [key: number]: number } = {};
    let remaining = sideWeight;

    plates.forEach(p => {
        const count = Math.floor(remaining / p);
        if (count > 0) {
            plateCounts[p] = count;
            remaining -= count * p;
        }
    });

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Plate Calculator</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>

                <div className="bg-gray-900 p-4 rounded-xl mb-6 text-center">
                    <p className="text-gray-400 text-sm mb-1">Target Weight</p>
                    <p className="text-4xl font-black text-white">{weight}kg</p>
                    <p className="text-xs text-blue-400 mt-2">Bar: 20kg + {sideWeight}kg / side</p>
                </div>

                <div className="space-y-2">
                    {Object.entries(plateCounts).map(([plate, count]) => (
                        <div key={plate} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-gray-900 ${Number(plate) >= 20 ? 'bg-red-500' :
                                    Number(plate) >= 10 ? 'bg-blue-500' :
                                        'bg-white'
                                    }`}>
                                    {plate}
                                </div>
                                <span className="font-bold text-lg">{count}x</span>
                            </div>
                            <span className="text-gray-400 text-sm">{plate}kg</span>
                        </div>
                    ))}
                    {Object.keys(plateCounts).length === 0 && (
                        <p className="text-center text-gray-500 italic">Just the bar! (20kg)</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const RestTimer: React.FC<{ isOpen: boolean; duration: number; onClose: () => void }> = ({ isOpen, duration, onClose }) => {
    const [timeLeft, setTimeLeft] = useState(duration);

    React.useEffect(() => {
        if (isOpen) {
            setTimeLeft(duration);
            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 4 && prev > 1) playBeep(); // Beep at 3, 2, 1
                    if (prev <= 1) {
                        playBeep(); // Final beep
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isOpen, duration]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl flex flex-col items-center w-80">
                <h3 className="text-xl font-bold text-gray-400 uppercase tracking-widest mb-4">Resting</h3>
                <div className="text-6xl font-black text-white font-mono mb-6">
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </div>
                <div className="flex gap-4 w-full">
                    <button
                        onClick={() => setTimeLeft(prev => prev + 10)}
                        className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold transition-colors"
                    >
                        +10s
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors"
                    >
                        {timeLeft === 0 ? "Let's Go!" : "Skip"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const WorkoutSummaryModal: React.FC<{
    isOpen: boolean;
    stats: { sets: number; calories: number; duration: string };
    onClose: () => void
}> = ({ isOpen, stats, onClose }) => {
    if (!isOpen) return null;

    // Generate confetti elements
    const confettiColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    const confetti = Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100 + '%',
        delay: Math.random() * 2 + 's',
        bg: confettiColors[Math.floor(Math.random() * confettiColors.length)]
    }));

    React.useEffect(() => {
        if (isOpen) {
            playFanfare();
        }
    }, [isOpen]);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <ConfettiStyle />
            {confetti.map(c => (
                <div key={c.id} className="confetti" style={{ left: c.left, animationDelay: c.delay, backgroundColor: c.bg }} />
            ))}

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 md:p-12 rounded-3xl border border-gray-700 shadow-2xl flex flex-col items-center w-full max-w-lg text-center relative overflow-hidden">
                <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                <div className="text-8xl mb-6 animate-bounce">🏆</div>
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-2">Workout Complete!</h2>
                <p className="text-gray-400 mb-8">You crushed it today! Here is your summary:</p>
                <div className="grid grid-cols-2 gap-4 w-full mb-8">
                    <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700">
                        <p className="text-sm text-gray-400 uppercase tracking-widest">Total Sets</p>
                        <p className="text-3xl font-black text-white">{stats.sets}</p>
                    </div>
                    <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700">
                        <p className="text-sm text-gray-400 uppercase tracking-widest">Calories</p>
                        <p className="text-3xl font-black text-orange-400">{stats.calories.toFixed(0)}</p>
                    </div>

                </div>
                <button onClick={onClose} className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transform hover:-translate-y-1 transition-all">
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
};

const ActiveWorkoutView: React.FC<{
    exercises: CatalogExercise[];
    activeIndex: number;
    logs: WorkoutLog;
    onAddSet: (id: string) => void;
    onToggleSet: (exId: string, setId: string) => void;
    onDeleteSet: (exId: string, setId: string) => void;
    onUpdateSet: (exId: string, setId: string, field: 'reps' | 'weight', val: string) => void;
    onNextExercise: () => void;
    onFinishWorkout: () => void;
}> = ({ exercises, activeIndex, logs, onAddSet, onToggleSet, onDeleteSet, onUpdateSet, onNextExercise, onFinishWorkout }) => {
    const activeExercise = exercises[activeIndex];
    const currentSets = logs[activeExercise.id] || [];

    // Calculate total calories for the session
    const totalCalories = Object.values(logs).flat().reduce((acc, set) => acc + (set.completed ? (set.calories || 0) : 0), 0);

    if (!activeExercise) return <div>No active exercise</div>;

    const isYoutube = activeExercise.videoUrl?.includes('youtube.com') || activeExercise.videoUrl?.includes('youtu.be');
    let embedUrl = activeExercise.videoUrl;
    if (isYoutube && embedUrl) {
        // Extract Video ID
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = embedUrl.match(regExp);
        const videoId = (match && match[2].length === 11) ? match[2] : null;

        if (videoId) {
            // GIF-like params: autoplay, mute, loop, no controls
            embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1`;
        }
    }

    const [showRestTimer, setShowRestTimer] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [plateCalcWeight, setPlateCalcWeight] = useState<number | null>(null);
    const [workoutStats, setWorkoutStats] = useState({ sets: 0, calories: 0, duration: '' });

    const { user } = useAppContext();

    // Handle Workout Finish
    const handleFinish = async () => {
        // Calculate stats
        let sets = 0;
        let calories = 0;

        Object.values(logs).forEach(exerciseLogs => {
            exerciseLogs.forEach(set => {
                if (set.completed) {
                    sets++;
                    calories += (set.calories || 0);
                }
            });
        });

        const stats = { sets, calories, duration: '45m' };
        setWorkoutStats(stats);
        setShowSummary(true);

        // Auto-send email report
        if (user && user.email) {
            try {
                // Determine today's date
                const today = new Date().toISOString().split('T')[0];

                // Note: We are sending a workout-specific report here
                await sendDailyReport(user.email, {
                    intake: 0, // Not available in this context without fetching entire dailyLog
                    burned: calories,
                    net: -calories,
                    date: today,
                    foods: [{ name: "Workout Session", calories: calories }] // Using 'foods' field hack to list workout
                });
                console.log("Workout report sent automatically.");
            } catch (error) {
                console.error("Failed to auto-send workout report:", error);
            }
        }
    };

    // Auto-trigger rest timer when a set is completed
    React.useEffect(() => {
    }, [logs]);

    return (
        <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white overflow-hidden">
            <RestTimer isOpen={showRestTimer} duration={60} onClose={() => setShowRestTimer(false)} />
            <PlateCalculator
                isOpen={!!plateCalcWeight}
                weight={plateCalcWeight || 0}
                onClose={() => setPlateCalcWeight(null)}
            />
            <WorkoutSummaryModal
                isOpen={showSummary}
                stats={workoutStats}
                onClose={() => {
                    setShowSummary(false);
                    onFinishWorkout(); // Call parent handler after modal close
                }}
            />
            {/* Sidebar: Queue */}
            <div className="w-full md:w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Workout Queue</h2>
                    <p className="text-sm text-gray-400 mb-2">{activeIndex + 1} of {exercises.length} exercises</p>
                    <div className="bg-gray-900 rounded-lg p-3 flex items-center justify-between border border-gray-700">
                        <span className="text-sm font-bold text-orange-400">🔥 Total Burn</span>
                        <span className="text-xl font-black text-white">{totalCalories.toFixed(1)} <span className="text-xs text-gray-500">kcal</span></span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {exercises.map((ex, idx) => (
                        <div key={ex.id} className={`p-3 rounded-lg flex items-center space-x-3 cursor-default ${idx === activeIndex ? 'bg-blue-600' : idx < activeIndex ? 'bg-gray-700/50 opacity-50' : 'bg-gray-700'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === activeIndex ? 'bg-white text-blue-600' : 'bg-gray-600 text-gray-300'}`}>
                                {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold truncate">{ex.name}</p>
                                <p className="text-xs text-gray-300 truncate">{ex.muscles.join(', ')}</p>
                            </div>
                            {idx < activeIndex && <span className="text-green-400">✓</span>}
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-gray-700">
                    <button onClick={handleFinish} className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold transition-colors">
                        End Workout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-y-auto bg-gray-900">
                {/* Header with Video */}
                <div className="relative w-full h-64 md:h-96 bg-black flex-shrink-0">
                    {isYoutube ? (
                        <iframe src={embedUrl} title={activeExercise.name} className="w-full h-full object-contain" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                    ) : (
                        <img src={activeExercise.videoUrl} alt={activeExercise.name} className="w-full h-full object-contain" />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 to-transparent p-6">
                        <h1 className="text-3xl md:text-4xl font-black text-white">{activeExercise.name}</h1>
                        <a href={activeExercise.videoUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-sm underline">See instructions</a>
                    </div>
                </div>

                {/* Set Logging Area */}
                <div className="max-w-3xl mx-auto w-full p-4 md:p-8 space-y-6">
                    <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Log Sets</h3>
                            <button className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg transition-colors">Add to favorites ★</button>
                        </div>

                        <div className="space-y-4">
                            {currentSets.map((set, setIdx) => (
                                <div key={set.id} className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 flex flex-wrap items-end gap-4 relative overflow-hidden">
                                    {set.completed && (
                                        <div className="absolute top-0 right-0 bg-orange-500/10 text-orange-400 text-xs font-bold px-2 py-1 rounded-bl-lg border-l border-b border-orange-500/20">
                                            🔥 {set.calories?.toFixed(1)} kcal
                                        </div>
                                    )}
                                    <div className="flex-none">
                                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-1">Set {setIdx + 1}</span>
                                        <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full text-xs text-gray-400 font-mono">#{setIdx + 1}</div>
                                        {/* 1RM Estimator (Epley Formula) */}
                                        {Number(set.weight) > 0 && Number(set.reps) > 0 && (
                                            <div className="mt-1 text-[10px] text-gray-500 font-mono">
                                                1RM: {Math.round(Number(set.weight) * (1 + Number(set.reps) / 30))}kg
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-[100px]">
                                        <label className="text-xs text-gray-400 mb-1 block">Reps</label>
                                        <input
                                            type="number"
                                            value={set.reps}
                                            onChange={(e) => onUpdateSet(activeExercise.id, set.id, 'reps', e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    {/* Hide Weight Input for Bodyweight-only exercises */}
                                    {(!activeExercise.equipment.some(e => e.toLowerCase() === 'bodyweight') || activeExercise.equipment.length > 1) && (
                                        <div className="flex-1 min-w-[100px]">
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-xs text-gray-400 block">Weight (kg)</label>
                                                <button onClick={() => setPlateCalcWeight(Number(set.weight) || 0)} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold bg-blue-900/30 px-2 rounded">Calc 🧮</button>
                                            </div>
                                            <input
                                                type="number"
                                                value={set.weight}
                                                onChange={(e) => onUpdateSet(activeExercise.id, set.id, 'weight', e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => {
                                            onToggleSet(activeExercise.id, set.id);
                                            // Only show rest timer if we are MARKING as done (not unchecking)
                                            if (!set.completed) {
                                                setShowRestTimer(true);
                                            }
                                        }}
                                        className={`flex-none px-6 py-2.5 rounded-lg font-bold transition-all ${set.completed ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                    >
                                        {set.completed ? '✓ Done' : 'Finish Set'}
                                    </button>
                                    <button onClick={() => onDeleteSet(activeExercise.id, set.id)} className="text-gray-500 hover:text-red-500 p-2">✕</button>
                                </div>
                            ))}
                        </div>

                        <button onClick={() => onAddSet(activeExercise.id)} className="mt-6 w-full py-3 border-2 border-dashed border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white rounded-xl font-bold transition-all">
                            + Add Set
                        </button>
                    </div>

                    <div className="flex justify-between pt-4 pb-20">
                        <button className="px-6 py-3 bg-gray-700 text-gray-300 rounded-xl font-bold hover:bg-gray-600 opacity-50 cursor-not-allowed">
                            ← Previous
                        </button>
                        <button
                            onClick={() => {
                                if (activeIndex < exercises.length - 1) {
                                    onNextExercise();
                                } else {
                                    handleFinish();
                                }
                            }}
                            className={`px-8 py-3 rounded-xl font-bold shadow-lg transform hover:-translate-y-1 transition-all ${activeIndex < exercises.length - 1
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                                : 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20'
                                }`}
                        >
                            {activeIndex < exercises.length - 1 ? 'Next Exercise →' : 'End Workout 🏁'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const GymManagement: React.FC = () => {
    const { navigateTo, user, addCaloriesOut } = useAppContext();
    const [step, setStep] = useState(1);
    const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
    const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
    const [availableExercises, setAvailableExercises] = useState<CatalogExercise[]>([]);
    const [myRoutine, setMyRoutine] = useState<CatalogExercise[]>([]);

    // Active Workout State
    const [isWorkoutActive, setIsWorkoutActive] = useState(false);
    const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
    const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog>({});

    // Workout Builder Logic
    const addToRoutine = (exercise: CatalogExercise) => {
        if (!myRoutine.find(e => e.id === exercise.id)) {
            setMyRoutine([...myRoutine, exercise]);
        }
    };

    const removeFromRoutine = (exerciseId: string) => {
        setMyRoutine(myRoutine.filter(e => e.id !== exerciseId));
    };

    // Active Workout Handlers
    const handleStartWorkout = () => {
        if (myRoutine.length === 0) return;
        setIsWorkoutActive(true);
        setActiveExerciseIndex(0);
    };

    const handleAddSet = (exerciseId: string) => {
        const currentSets = workoutLogs[exerciseId] || [];
        const newSet: WorkoutSet = {
            id: Date.now().toString(),
            reps: '12',
            weight: '0',
            completed: false
        };
        setWorkoutLogs({
            ...workoutLogs,
            [exerciseId]: [...currentSets, newSet]
        });
    };

    const handleToggleSet = (exerciseId: string, setId: string) => {
        const currentSets = workoutLogs[exerciseId] || [];
        const updatedSets = currentSets.map(s => {
            if (s.id === setId) {
                const isCompleted = !s.completed;
                let calories = 0;

                // Calculate calories regardless of completion state for accurate diffing
                // "Accurate" Calorie Formula (METs)
                const userWeight = user?.weight || 75;
                const reps = parseInt(s.reps) || 0;
                const liftedWeight = parseFloat(s.weight) || 0;

                const metValue = 6.0;
                const durationHours = (reps * 4) / 3600;
                const baseBurn = metValue * userWeight * durationHours;
                const intensityFactor = 1 + (liftedWeight / userWeight) * 0.2;

                const calculatedCalories = baseBurn * intensityFactor;

                if (isCompleted) {
                    calories = calculatedCalories;
                    // Add to global log
                    addCaloriesOut(calculatedCalories);
                } else {
                    // Subtract from global log if unchecking
                    // We use the PREVIOUSLY calculated calories stored in the set if available, 
                    // or recalculate if missing (though it should be there if it was completed)
                    const caloriesToRemove = s.calories || calculatedCalories;
                    addCaloriesOut(-caloriesToRemove);
                }

                return { ...s, completed: isCompleted, calories };
            }
            return s;
        });
        setWorkoutLogs({
            ...workoutLogs,
            [exerciseId]: updatedSets
        });
    };


    const handleDeleteSet = (exerciseId: string, setId: string) => {
        const currentSets = workoutLogs[exerciseId] || [];
        setWorkoutLogs({
            ...workoutLogs,
            [exerciseId]: currentSets.filter(s => s.id !== setId)
        });
    };

    const handleUpdateSet = (exerciseId: string, setId: string, field: 'reps' | 'weight', value: string) => {
        const currentSets = workoutLogs[exerciseId] || [];
        const updatedSets = currentSets.map(s =>
            s.id === setId ? { ...s, [field]: value } : s
        );
        setWorkoutLogs({
            ...workoutLogs,
            [exerciseId]: updatedSets
        });
    }

    // Step 1: Equipment Selection
    const toggleEquipment = (id: string) => {
        setSelectedEquipment(prev =>
            prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
        );
    };

    const handleNextStep1 = () => {
        if (selectedEquipment.length > 0) {
            setStep(2);
        } else {
            alert("Please select at least one equipment.");
        }
    };

    // Step 2: Muscle Selection
    const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Forearms', 'Neck'];

    const toggleMuscle = (muscle: string) => {
        setSelectedMuscles(prev =>
            prev.includes(muscle) ? prev.filter(m => m !== muscle) : [...prev, muscle]
        );
    };

    const handleNextStep2 = () => {
        if (selectedMuscles.length > 0) {
            // Filter exercises
            const filtered = EXERCISE_CATALOG.filter(ex => {
                // Check equipment (Inclusive: Show if exercise uses ANY of the selected equipment)
                // This allows users to see "Bench Press" (Bench + Barbell) even if they only select "Bench".
                // We assume if users click "Bench", they want to explore all Bench exercises.
                const hasEquipment = ex.equipment.some(eq =>
                    selectedEquipment.find(sel => sel.toLowerCase() === eq.toLowerCase() || eq.toLowerCase().includes(sel.toLowerCase()))
                );
                // Check muscles (Basic logical OR - show if ANY target muscle is selected)
                const hasMuscle = ex.muscles.some(m => selectedMuscles.includes(m));
                return hasEquipment && hasMuscle;
            });
            setAvailableExercises(filtered);
            setStep(3);
        } else {
            alert("Please select at least one muscle group.");
        }
    };

    if (isWorkoutActive) {
        return (
            <ActiveWorkoutView
                exercises={myRoutine}
                activeIndex={activeExerciseIndex}
                logs={workoutLogs}
                onAddSet={handleAddSet}
                onToggleSet={handleToggleSet}
                onDeleteSet={handleDeleteSet}
                onUpdateSet={handleUpdateSet}
                onNextExercise={() => {
                    if (activeExerciseIndex < myRoutine.length - 1) {
                        setActiveExerciseIndex(prev => prev + 1);
                    } else {
                        // Finish workout logic
                        // Finish workout logic
                        // Alert removed, handled by modal inside component
                        setIsWorkoutActive(false);
                        setStep(1); // Go back to start or keep layout
                        setMyRoutine([]); // Clear routine? or keep
                    }
                }}
                onFinishWorkout={() => {
                    setIsWorkoutActive(false);
                    setStep(1); // Reset to start
                    setMyRoutine([]); // Optional: Clear routine
                }}
            />
        );
    }

    // Render Logic
    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in pb-20">
            {/* Header / Stepper - Glassmorphic */}
            <div className="sticky top-20 z-20 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-white/20 dark:border-gray-800 transition-all duration-300">
                <div className="flex justify-between items-center max-w-4xl mx-auto relative">
                    {/* Progress Bar Background */}
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 dark:bg-gray-700 -z-10 rounded-full transform -translate-y-1/2"></div>
                    {/* Progress Bar Active */}
                    <div className="absolute top-1/2 left-0 h-1 bg-blue-500 -z-10 rounded-full transform -translate-y-1/2 transition-all duration-500 ease-out" style={{ width: `${(step - 1) * 50}%` }}></div>

                    {[1, 2, 3, 4].map((s) => (
                        <div key={s} className="flex flex-col items-center relative z-10 group cursor-default" onClick={() => step > s && setStep(s)}>
                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-lg md:text-xl transition-all duration-300 shadow-lg ${step >= s ? 'bg-blue-600 text-white scale-110 ring-4 ring-blue-100 dark:ring-blue-900/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-2 border-gray-200 dark:border-gray-700'}`}>
                                {step > s ? '✓' : s}
                            </div>
                            <span className={`mt-2 text-xs md:text-sm font-bold bg-white/80 dark:bg-gray-900/80 px-2 py-1 rounded-md backdrop-blur-sm ${step >= s ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                                {s === 1 ? 'Equipment' : s === 2 ? 'Muscles' : s === 3 ? 'Select' : 'Review'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="min-h-[500px]">
                {/* Step 1: Equipment */}
                {step === 1 && (
                    <div className="animate-fade-in-up">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Select your gear</h2>
                            <p className="text-gray-500 dark:text-gray-400">Whatever you have, we can work with it.</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                            {EQUIPMENT_LIST.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => toggleEquipment(item.id)}
                                    className={`group relative p-6 rounded-3xl border transition-all duration-300 flex flex-col items-center justify-center space-y-4 overflow-hidden ${selectedEquipment.includes(item.id)
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-xl shadow-blue-500/10 scale-105'
                                        : 'border-transparent bg-white dark:bg-gray-800 hover:shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                                >
                                    {selectedEquipment.includes(item.id) && (
                                        <div className="absolute top-3 right-3 text-blue-500">
                                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        </div>
                                    )}
                                    <span className="text-5xl transform group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                                    <span className={`font-bold text-lg ${selectedEquipment.includes(item.id) ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>{item.name}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex justify-between mt-10">
                            <button
                                onClick={() => navigateTo('DASHBOARD')}
                                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-bold flex items-center px-6 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                Back to Dashboard
                            </button>
                            <button
                                onClick={handleNextStep1}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-1 hover:scale-105 flex items-center space-x-2"
                            >
                                <span>Next Step</span>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Muscles (Body Map) */}
                {step === 2 && (
                    <div className="animate-fade-in-up">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Target Muscles</h2>
                            <p className="text-gray-500 dark:text-gray-400">Click on the muscles you want to focus on.</p>
                        </div>

                        <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/20 dark:border-gray-700/50">

                            {/* Quick Select Presets */}
                            <div className="flex flex-wrap justify-center gap-2 mb-6">
                                <span className="w-full text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Quick Select</span>
                                {[
                                    { name: 'Push', muscles: ['Chest', 'Shoulders', 'Triceps'] },
                                    { name: 'Pull', muscles: ['Back', 'Biceps'] },
                                    { name: 'Legs', muscles: ['Quads', 'Hamstrings', 'Glutes', 'Calves'] },
                                    { name: 'Upper Body', muscles: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core'] },
                                    { name: 'Full Body', muscles: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'] },
                                ].map(preset => (
                                    <button
                                        key={preset.name}
                                        onClick={() => {
                                            // Add all muscles from preset that aren't already selected
                                            const newMuscles = [...new Set([...selectedMuscles, ...preset.muscles])];
                                            setSelectedMuscles(newMuscles);
                                        }}
                                        className="px-4 py-2 bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-sm font-bold border border-gray-200 dark:border-gray-600 transition-all shadow-sm hover:shadow-md"
                                    >
                                        {preset.name}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setSelectedMuscles([])}
                                    className="px-4 py-2 bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl text-sm font-bold border border-red-100 dark:border-red-900/30 transition-all"
                                >
                                    Clear All
                                </button>
                            </div>

                            <BodyMap selectedMuscles={selectedMuscles} onToggle={toggleMuscle} />

                            {/* Selected Chips */}
                            <div className="mt-8 flex flex-wrap justify-center gap-2 min-h-[40px]">
                                {selectedMuscles.length === 0 && <span className="text-gray-400 italic text-sm">No muscles selected yet... tap on the body map!</span>}
                                {selectedMuscles.map(m => (
                                    <span key={m} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-semibold border border-blue-200 dark:border-blue-800 flex items-center animate-fade-in-scale">
                                        {m}
                                        <button onClick={() => toggleMuscle(m)} className="ml-2 hover:text-blue-800 dark:hover:text-blue-200 w-4 h-4 flex items-center justify-center rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">×</button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-between mt-10">
                            <button
                                onClick={() => setStep(1)}
                                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-bold flex items-center px-6 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18"></path></svg>
                                Back
                            </button>
                            <button
                                onClick={handleNextStep2}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-1 hover:scale-105 flex items-center space-x-2"
                            >
                                <span>Show Exercises</span>
                                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Exercises */}
                {step === 3 && (
                    <div className="animate-fade-in-up">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Build Your Routine</h2>
                            <p className="text-gray-500 dark:text-gray-400">Found <span className="font-bold text-blue-600 dark:text-blue-400">{availableExercises.length}</span> exercises. Selected: <span className="font-bold text-green-600 dark:text-green-400">{myRoutine.length}</span></p>
                        </div>

                        <div className="space-y-4">
                            {availableExercises.length === 0 ? (
                                <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                    <span className="text-6xl mb-4 block">🤷‍♂️</span>
                                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">No exercises found</h3>
                                    <p className="text-gray-500 mb-2">We couldn't find any exercises with your exact equipment.</p>
                                    <p className="text-sm text-blue-500">Tip: Check if you have Dumbbells or Plates available!</p>
                                </div>
                            ) : (
                                availableExercises.map((ex) => {
                                    const isSelected = myRoutine.some(r => r.id === ex.id);
                                    return (
                                        <div key={ex.id} className={`group bg-white dark:bg-gray-800 border p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between transition-all duration-300 transform hover:-translate-y-1 gap-6 ${isSelected ? 'border-green-500 ring-4 ring-green-100 dark:ring-green-900/30' : 'border-gray-100 dark:border-gray-700 hover:shadow-xl hover:border-blue-500/30'}`}>
                                            <div className="flex items-center space-x-5 flex-1">
                                                {ex.videoUrl ? (
                                                    <div className="w-full h-48 md:w-96 md:h-64 flex-shrink-0 rounded-xl overflow-hidden shadow-md border border-gray-200 dark:border-gray-700 bg-black relative group-hover:scale-105 transition-transform duration-300">
                                                        {(() => {
                                                            const isYoutube = ex.videoUrl.includes('youtube.com') || ex.videoUrl.includes('youtu.be');
                                                            if (isYoutube) {
                                                                let embedUrl = ex.videoUrl;
                                                                // Extract Video ID
                                                                const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                                                                const match = embedUrl.match(regExp);
                                                                const videoId = (match && match[2].length === 11) ? match[2] : null;

                                                                if (videoId) {
                                                                    // GIF-like params: autoplay, mute, loop, no controls
                                                                    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1`;
                                                                } else {
                                                                    // Fallback for weird URLs
                                                                    if (ex.videoUrl.includes('watch?v=')) {
                                                                        embedUrl = ex.videoUrl.replace('watch?v=', 'embed/');
                                                                    } else if (ex.videoUrl.includes('youtu.be/')) {
                                                                        embedUrl = ex.videoUrl.replace('youtu.be/', 'www.youtube.com/embed/');
                                                                    }
                                                                }

                                                                return (
                                                                    <iframe
                                                                        src={embedUrl}
                                                                        title={ex.name}
                                                                        className="w-full h-full object-cover pointer-events-none" // pointer-events-none prevents pausing on click
                                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                        allowFullScreen
                                                                    ></iframe>
                                                                )
                                                            }
                                                            return <img src={ex.videoUrl} alt={ex.name} className="w-full h-full object-cover" />;
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-4xl">
                                                        <span>🏋️</span>
                                                    </div>
                                                )}
                                                <div>
                                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{ex.name}</h3>
                                                    <div className="flex space-x-2 text-sm text-gray-500 dark:text-gray-400">
                                                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md">{ex.difficulty}</span>
                                                        <span>•</span>
                                                        <span>{ex.muscles.join(', ')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col space-y-2 w-full md:w-auto">
                                                <button
                                                    onClick={() => isSelected ? removeFromRoutine(ex.id) : addToRoutine(ex)}
                                                    className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 ${isSelected ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-500/30'}`}
                                                >
                                                    {isSelected ? (
                                                        <>
                                                            <span>Remove</span>
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>Add to Routine</span>
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                                        </>
                                                    )}
                                                </button>
                                                {ex.videoUrl && ex.videoUrl.includes('youtu') && (
                                                    <a
                                                        href={ex.videoUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 border border-gray-200 dark:border-gray-700 rounded-xl font-bold transition-all flex items-center justify-center space-x-2"
                                                    >
                                                        <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg>
                                                        <span>Watch on YouTube</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Floating Footer for Review */}
                        {myRoutine.length > 0 && (
                            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 shadow-2xl z-30 animate-fade-in-up">
                                <div className="max-w-7xl mx-auto flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg animate-bounce-short">
                                            {myRoutine.length}
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">Exercises Selected</p>
                                            <p className="font-bold text-gray-900 dark:text-white">Ready to review?</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setStep(4)}
                                        className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-green-500/20 transform hover:-translate-y-1 transition-all flex items-center space-x-2"
                                    >
                                        <span>Review & Save</span>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-start mt-10 pb-20">
                            <button
                                onClick={() => setStep(2)}
                                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-bold flex items-center px-6 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18"></path></svg>
                                Back to Muscles
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Review Routine */}
                {step === 4 && (
                    <div className="animate-fade-in-up">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">🎉 Your Workout</h2>
                            <p className="text-gray-500 dark:text-gray-400">Review your customized routine below.</p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-10 shadow-xl border border-gray-100 dark:border-gray-700">
                            <div className="space-y-4 mb-8">
                                {myRoutine.map((ex, idx) => (
                                    <div key={ex.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                                        <div className="flex items-center space-x-4">
                                            <span className="w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-full text-sm">
                                                {idx + 1}
                                            </span>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">{ex.name}</h4>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{ex.muscles.join(', ')}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeFromRoutine(ex.id)}
                                            className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Remove"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                                <button
                                    onClick={() => setStep(3)}
                                    className="px-6 py-4 rounded-xl font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => setStep(3)}
                                    className="flex-1 text-gray-700 dark:text-gray-300 font-bold px-6 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Add More Exercises
                                </button>
                                <button
                                    onClick={handleStartWorkout}
                                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-6 py-4 rounded-xl shadow-lg shadow-green-500/30 transform hover:-translate-y-1 transition-all flex items-center justify-center"
                                >
                                    <span>Start Workout</span>
                                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GymManagement;
