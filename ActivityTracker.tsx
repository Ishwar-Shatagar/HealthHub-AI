import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { ICONS } from '../constants';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import NearbyDoctors from '../components/NearbyDoctors';

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface WorkoutSession {
    id: string;
    date: string;
    duration: number;
    distance: number;
    calories: number;
    steps: number;
    goalType: 'STEPS';
    goalValue: number;
    goalAchieved: boolean;
}

// Component to center map on user location
const RecenterMap = ({ lat, lng }: { lat: number; lng: number }) => {
    const map = useMap();
    useEffect(() => {
        map.panTo([lat, lng], { animate: true, duration: 0.5 });
    }, [lat, lng, map]);
    return null;
};

// Helper Component for Stat Cards
const StatCard = ({ label, value, unit, icon, color }: { label: string, value: string | number, unit: string, icon: React.ReactNode, color: string }) => (
    <div className={`bg-white dark:bg-gray-800/50 backdrop-blur-sm p-4 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm hover:border-${color}-500/50 transition-colors`}>
        <div className="flex items-start justify-between mb-2">
            <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">{label}</span>
            <span className={`text-${color}-500 dark:text-${color}-400 text-xl`}>{icon}</span>
        </div>
        <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{unit}</span>
        </div>
    </div>
);

const ActivityTracker: React.FC = () => {
    const { user, addCaloriesOut } = useAppContext();
    const [isTracking, setIsTracking] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [distance, setDistance] = useState(0); // in km
    const [steps, setSteps] = useState(0);
    const [caloriesBurned, setCaloriesBurned] = useState(0);
    const [currentPace, setCurrentPace] = useState(0); // min/km
    const [elevationData, setElevationData] = useState<{ time: string; elevation: number }[]>([]);
    const [path, setPath] = useState<[number, number][]>([]);
    const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
    const [error, setError] = useState<string | null>(null);

    // New Features State
    const [weather, setWeather] = useState<{ temp: number; wind: number; code: number } | null>(null);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<WorkoutSession[]>([]);

    // Goal State
    const [targetSteps, setTargetSteps] = useState(10000);
    const [isEditingTarget, setIsEditingTarget] = useState(false);
    const [goalAchieved, setGoalAchieved] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);

    const watchIdRef = useRef<number | null>(null);
    const prevPosRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Load History & Target
    useEffect(() => {
        const savedHistory = localStorage.getItem('workout_history');
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory));
            } catch (e) {
                console.error("Failed to parse history", e);
            }
        }

        const savedTarget = localStorage.getItem('daily_step_target');
        if (savedTarget) {
            setTargetSteps(Number(savedTarget));
        } else if (user && user.bmi) {
            // Default BMI logic if no saved target
            let recommended = 10000;
            if (user.bmi < 18.5) recommended = 8000;
            else if (user.bmi < 25) recommended = 10000;
            else if (user.bmi < 30) recommended = 12000;
            else recommended = 7500;
            setTargetSteps(recommended);
        }
    }, [user]);

    // Save Target on Change
    useEffect(() => {
        localStorage.setItem('daily_step_target', targetSteps.toString());
    }, [targetSteps]);

    // Voice Coach Helper
    // Voice Coach Helper
    const speak = (text: string) => {
        if (!voiceEnabled || !window.speechSynthesis) return;
        window.speechSynthesis.cancel(); // Cancel any ongoing speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
    };

    // Fetch Weather
    useEffect(() => {
        if (currentPos && !weather) {
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${currentPos[0]}&longitude=${currentPos[1]}&current_weather=true`)
                .then(res => res.json())
                .then(data => {
                    if (data.current_weather) {
                        setWeather({
                            temp: data.current_weather.temperature,
                            wind: data.current_weather.windspeed,
                            code: data.current_weather.weathercode
                        });
                    }
                })
                .catch(err => console.error("Weather fetch error:", err));
        }
    }, [currentPos, weather]);

    // Timer Logic
    useEffect(() => {
        if (isTracking) {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => {
                    const newTime = prev + 1;
                    // Voice Coach: Time Milestone (every 5 minutes)
                    if (newTime > 0 && newTime % 300 === 0) {
                        const mins = newTime / 60;
                        speak(`You have been active for ${mins} minutes.`);
                    }
                    return newTime;
                });
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isTracking, voiceEnabled]);

    // Calculate Total Steps Today
    const getTodaySteps = () => {
        const today = new Date().toDateString();
        const historySteps = history
            .filter(session => new Date(session.date).toDateString() === today)
            .reduce((sum, session) => sum + session.steps, 0);
        return historySteps + steps;
    };

    // Check Goal Achievement
    useEffect(() => {
        if (goalAchieved) return;
        const totalSteps = getTodaySteps();

        if (totalSteps >= targetSteps && targetSteps > 0) {
            setGoalAchieved(true);
            setShowCelebration(true);
            speak("Daily step target achieved! Congratulations!");
            setTimeout(() => setShowCelebration(false), 5000);
        }
    }, [steps, history, targetSteps, goalAchieved]);

    // GPS Tracking Logic
    useEffect(() => {
        if (isTracking) {
            if (!navigator.geolocation) {
                setError("Geolocation is not supported by your browser.");
                return;
            }

            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude, altitude } = position.coords;
                    const currentTime = Date.now();

                    setCurrentPos([latitude, longitude]);

                    if (prevPosRef.current) {
                        const dist = calculateDistance(
                            prevPosRef.current.lat,
                            prevPosRef.current.lng,
                            latitude,
                            longitude
                        );

                        // Filter out GPS noise (e.g., extremely small movements)
                        if (dist > 0.0005) {
                            setDistance(prev => {
                                const newDist = prev + dist;
                                // Voice Coach: Distance Milestone (every 1 km)
                                if (Math.floor(newDist) > Math.floor(prev)) {
                                    speak(`Congratulations! You have reached ${Math.floor(newDist)} kilometers.`);
                                }
                                return newDist;
                            });

                            const strideLength = user ? (user.height / 100) * 0.414 : 0.762;
                            const newSteps = Math.floor((dist * 1000) / strideLength);
                            setSteps(prev => prev + newSteps);

                            const timeDiff = (currentTime - prevPosRef.current.time) / 1000 / 60;
                            if (dist > 0) {
                                setCurrentPace(timeDiff / dist);
                            }

                            const met = 4.0;
                            const hours = timeDiff / 60;
                            const burned = met * (user?.weight || 70) * hours;
                            setCaloriesBurned(prev => prev + burned);

                            setPath(prev => [...prev, [latitude, longitude]]);
                        }
                    } else {
                        setPath([[latitude, longitude]]);
                    }

                    setElevationData(prev => [
                        ...prev.slice(-20),
                        { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), elevation: altitude || 0 }
                    ]);

                    prevPosRef.current = { lat: latitude, lng: longitude, time: currentTime };
                },
                (err) => {
                    console.error("GPS Error:", err);
                    setError("Unable to retrieve location. Please check permissions.");
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            prevPosRef.current = null;
        }

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [isTracking, user, voiceEnabled]);

    // Haversine Formula
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c;
        return d;
    };

    const deg2rad = (deg: number) => {
        return deg * (Math.PI / 180);
    };

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs > 0 ? `${hrs}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatPace = (pace: number) => {
        if (!isFinite(pace) || pace === 0) return "0'00\"";
        const mins = Math.floor(pace);
        const secs = Math.floor((pace - mins) * 60);
        return `${mins}'${secs.toString().padStart(2, '0')}"`;
    };

    const handleStop = () => {
        setIsTracking(false);
        speak("Workout completed. Great job!");
        if (caloriesBurned > 0 || distance > 0) {
            const newSession: WorkoutSession = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                duration: elapsedTime,
                distance: distance,
                calories: caloriesBurned,
                steps: steps,
                goalType: 'STEPS',
                goalValue: targetSteps,
                goalAchieved: getTodaySteps() >= targetSteps // Check if daily goal met
            };

            const updatedHistory = [newSession, ...history];
            setHistory(updatedHistory);
            localStorage.setItem('workout_history', JSON.stringify(updatedHistory));

            addCaloriesOut(caloriesBurned);

            // Reset stats
            setElapsedTime(0);
            setDistance(0);
            setSteps(0);
            setCaloriesBurned(0);
            setCurrentPace(0);
            setPath([]);
            setElevationData([]);
            // Don't reset goalAchieved here, as it's daily
        }
    };

    const getWeatherIcon = (code: number) => {
        if (code <= 3) return "☀️";
        if (code <= 48) return "☁️";
        if (code <= 67) return "🌧️";
        if (code <= 77) return "❄️";
        return "🌦️";
    };

    const getGoalProgress = () => {
        return Math.min((getTodaySteps() / targetSteps) * 100, 100);
    };

    return (
        <div className="w-full h-full font-sans text-gray-900 dark:text-white transition-colors duration-300 relative">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                            Activity Tracker
                        </h1>
                        <div
                            onClick={() => setIsEditingTarget(true)}
                            className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 cursor-pointer hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                            title="Click to edit daily target"
                        >
                            <span>🎯</span>
                            {isEditingTarget ? (
                                <input
                                    type="number"
                                    value={targetSteps}
                                    onChange={(e) => setTargetSteps(Number(e.target.value))}
                                    onBlur={() => setIsEditingTarget(false)}
                                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingTarget(false)}
                                    className="w-20 bg-transparent border-b border-emerald-500 focus:outline-none text-center"
                                    autoFocus
                                />
                            ) : (
                                <span>Target: {targetSteps.toLocaleString()} Steps ✏️</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                        <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2 text-sm">
                            {ICONS.mapPin} {new Date().toLocaleDateString()} &bull; {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {weather && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full text-xs font-medium border border-blue-100 dark:border-blue-800">
                                <span className="text-lg">{getWeatherIcon(weather.code)}</span>
                                <span>{weather.temp}°C</span>
                                <span className="text-blue-400">•</span>
                                <span>{weather.wind} km/h Wind</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowHistory(true)}
                        className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="View History"
                    >
                        {ICONS.history || <span className="text-xl">📅</span>}
                    </button>
                    <button
                        onClick={() => setVoiceEnabled(!voiceEnabled)}
                        className={`p-3 rounded-2xl border transition-all ${voiceEnabled
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400'
                            }`}
                        title={voiceEnabled ? "Voice Coach Active" : "Voice Coach Muted"}
                    >
                        {voiceEnabled ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                        )}
                    </button>

                    {voiceEnabled && (
                        <button
                            onClick={() => speak("Voice Coach is active and working correctly. Keep moving!")}
                            className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                            title="Test Voice Coach"
                        >
                            <span className="text-xl">🔊</span>
                        </button>
                    )}

                    <div className="flex items-center gap-4 bg-white dark:bg-gray-900/80 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-500/20" style={{ width: `${getGoalProgress()}%`, transition: 'width 0.5s ease-out' }}></div>
                        <div className="text-right relative z-10">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                                Today: {getTodaySteps().toLocaleString()} / {targetSteps.toLocaleString()}
                            </div>
                            <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white tabular-nums leading-none">
                                {formatTime(elapsedTime)}
                            </div>
                        </div>
                        <div className={`w-3 h-3 rounded-full relative z-10 ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-600'}`}></div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Map Section */}
                <div className="xl:col-span-2 h-[65vh] min-h-[500px] bg-white dark:bg-gray-900 rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-xl dark:shadow-2xl relative group">
                    {currentPos ? (
                        <MapContainer
                            center={currentPos}
                            zoom={18}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                className="map-tiles"
                            />
                            <RecenterMap lat={currentPos[0]} lng={currentPos[1]} />
                            <Marker position={currentPos}>
                                <Popup>You are here</Popup>
                            </Marker>
                            <Polyline positions={path} color="#3B82F6" weight={5} opacity={0.8} />
                        </MapContainer>
                    ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 gap-4">
                            <svg className="w-16 h-16 animate-bounce opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            <p className="text-lg font-medium">{isTracking ? "Acquiring GPS Signal..." : "Start tracking to view map"}</p>
                        </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/80 dark:from-gray-900/80 to-transparent pointer-events-none"></div>
                </div>

                {/* Stats Sidebar */}
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <StatCard
                            label="Distance"
                            value={distance.toFixed(2)}
                            unit="km"
                            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>}
                            color="blue"
                        />
                        <StatCard
                            label="Steps"
                            value={steps}
                            unit=""
                            icon={<span className="text-lg">👟</span>}
                            color="emerald"
                        />
                        <StatCard
                            label="Calories"
                            value={caloriesBurned.toFixed(0)}
                            unit="kcal"
                            icon={<span className="text-lg">🔥</span>}
                            color="orange"
                        />
                        <StatCard
                            label="Avg Pace"
                            value={formatPace(currentPace)}
                            unit="/km"
                            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>}
                            color="purple"
                        />
                    </div>

                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 flex-1 min-h-[200px] flex flex-col shadow-sm">
                        <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                            <span className="font-medium text-xs uppercase tracking-wide">Elevation Profile</span>
                        </div>
                        <div className="flex-1 w-full min-h-[120px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={elevationData}>
                                    <defs>
                                        <linearGradient id="colorElevation" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                    <XAxis dataKey="time" hide />
                                    <YAxis hide domain={['auto', 'auto']} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff', borderRadius: '0.5rem', fontSize: '12px' }}
                                        itemStyle={{ color: '#60A5FA' }}
                                    />
                                    <Area type="monotone" dataKey="elevation" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorElevation)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-gray-200 dark:border-gray-800 flex justify-center items-center shadow-sm">
                        {!isTracking ? (
                            <button
                                onClick={() => {
                                    setIsTracking(true);
                                    speak("Workout started. Let's hit that goal!");
                                }}
                                className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl transition-all w-full font-bold text-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
                            >
                                <span className="text-2xl">▶</span>
                                Start Workout
                            </button>
                        ) : (
                            <button
                                onClick={handleStop}
                                className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl transition-all w-full font-bold text-lg shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:-translate-y-0.5 animate-pulse"
                            >
                                <span className="text-2xl">⏹</span>
                                End Workout
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Celebration Overlay */}
            {showCelebration && (
                <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-500">
                    <div className="text-6xl mb-4 animate-bounce">🏆</div>
                    <h2 className="text-4xl font-bold text-white mb-2 text-center">Goal Achieved!</h2>
                    <p className="text-white/80 text-lg">You crushed your target!</p>
                </div>
            )}

            {/* History Modal */}
            {showHistory && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Workout History</h2>
                            <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="overflow-y-auto p-6 space-y-4">
                            {history.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No workouts recorded yet.</p>
                            ) : (
                                history.map(session => (
                                    <div key={session.id} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                {new Date(session.date).toLocaleDateString()} • {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {session.goalAchieved && (
                                                <span className="text-xs font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-full flex items-center gap-1">
                                                    <span>🏆</span> Goal Met
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <div className="text-xs text-gray-400">Distance</div>
                                                <div className="font-bold text-gray-900 dark:text-white">{session.distance.toFixed(2)} km</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400">Time</div>
                                                <div className="font-bold text-gray-900 dark:text-white">{formatTime(session.duration)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400">Calories</div>
                                                <div className="font-bold text-gray-900 dark:text-white">{session.calories.toFixed(0)} kcal</div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
            <NearbyDoctors searchType="general" title="Nearby Sports Medicine & Physiotherapy Clinics" />
        </div>
    );
};

export default ActivityTracker;
