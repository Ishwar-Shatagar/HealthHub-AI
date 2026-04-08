import React, { useEffect, useRef, useState, useCallback } from 'react';

type SkillLevel = 'Beginner' | 'Intermediate' | 'Expert';
type YogaPose = 'Tree Pose' | 'Warrior II' | 'Mountain Pose';

interface Point3D {
    x: number;
    y: number;
    z: number;
    visibility: number;
}

interface PoseEvaluation {
    status: 'correct' | 'incorrect' | 'error';
    pose: string;
    accuracy: number;
    feedback: string[];
    highlight_joints: string[];
    message?: string;
}

// MediaPipe skeleton connections
const POSE_CONNECTIONS: [number, number][] = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Upper body
    [11, 23], [12, 24], [23, 24],                     // Torso
    [23, 25], [25, 27], [24, 26], [26, 28],           // Lower body
    [27, 29], [29, 31], [27, 31],                     // Left Foot
    [28, 30], [30, 32], [28, 32],                     // Right Foot
    [15, 17], [15, 19], [15, 21],                     // Left Hand
    [16, 18], [16, 20], [16, 22]                      // Right Hand
];

// Landmark name map matching backend
const LM_MAP: Record<string, number> = {
    "LEFT_SHOULDER": 11, "RIGHT_SHOULDER": 12,
    "LEFT_ELBOW": 13, "RIGHT_ELBOW": 14,
    "LEFT_WRIST": 15, "RIGHT_WRIST": 16,
    "LEFT_HIP": 23, "RIGHT_HIP": 24,
    "LEFT_KNEE": 25, "RIGHT_KNEE": 26,
    "LEFT_ANKLE": 27, "RIGHT_ANKLE": 28,
};

const YOLO_POSES = ['Tree Pose', 'Warrior II', 'Mountain Pose'];

const YogaPoseDetector: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [tolerance, setTolerance] = useState<SkillLevel>('Beginner');
    
    const [isRunning, setIsRunning] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [evalData, setEvalData] = useState<PoseEvaluation | null>(null);

    const poseRef = useRef<any>(null);
    const cameraRef = useRef<any>(null);
    const wsRef = useRef<WebSocket | null>(null);
    
    const lastSpokenRef = useRef<number>(0);
    const lastEvalRef = useRef<string>('');

    // Load MediaPipe scripts
    useEffect(() => {
        if ((window as any).Pose && (window as any).Camera) { setScriptsLoaded(true); return; }
        const scripts = [
            { id: 'mp-drawing', src: 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js' },
            { id: 'mp-pose', src: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js' },
            { id: 'mp-camera', src: 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js' },
        ];
        let loaded = 0;
        for (const s of scripts) {
            if (document.getElementById(s.id)) { loaded++; if (loaded === scripts.length) setScriptsLoaded(true); continue; }
            const el = document.createElement('script');
            el.id = s.id; el.src = s.src; el.crossOrigin = 'anonymous';
            el.onload = () => { loaded++; if (loaded === scripts.length) setScriptsLoaded(true); };
            el.onerror = () => setError('Failed to load MediaPipe. Check your internet connection.');
            document.head.appendChild(el);
        }
    }, []);

    // WebSocket Setup
    const setupWebSocket = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
        const port = 8000;
        const ws = new WebSocket(`ws://${window.location.hostname}:${port}/ws/yoga-pose`);
        
        ws.onopen = () => console.log('Yoga WebSocket Connected');
        ws.onmessage = (e) => {
            try {
                const rs: PoseEvaluation = JSON.parse(e.data);
                setEvalData(rs);
                
                // Voice feedback
                if (rs.feedback && rs.feedback.length > 0) {
                    const now = Date.now();
                    const fb_hash = rs.feedback.join("|");
                    // Speak only once every 4 seconds, or if feedback completely changes
                    if (now - lastSpokenRef.current > 4000 || fb_hash !== lastEvalRef.current) {
                        speak(rs.feedback[0]);
                        lastSpokenRef.current = now;
                        lastEvalRef.current = fb_hash;
                    }
                } else if (rs.status === 'correct') {
                    const now = Date.now();
                    if (now - lastSpokenRef.current > 6000 && lastEvalRef.current !== 'correct') {
                        speak("Perfect! Hold that pose.");
                        lastSpokenRef.current = now;
                        lastEvalRef.current = 'correct';
                    }
                }
            } catch (err) {}
        };
        ws.onclose = () => console.log('Yoga WebSocket Disconnected');
        wsRef.current = ws;
    };

    const stopMonitor = useCallback(() => {
        if (cameraRef.current) { cameraRef.current.stop(); cameraRef.current = null; }
        if (poseRef.current) { poseRef.current.close(); poseRef.current = null; }
        if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
        const canvas = canvasRef.current;
        if (canvas) { const ctx = canvas.getContext('2d'); ctx?.clearRect(0, 0, canvas.width, canvas.height); }
        if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); }
        setIsRunning(false);
        setEvalData(null);
    }, []);

    useEffect(() => {
        return () => stopMonitor();
    }, [stopMonitor]);

    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.1;
            window.speechSynthesis.speak(utterance);
        }
    };

    const drawSkeleton = (ctx: CanvasRenderingContext2D, landmarks: Point3D[], w: number, h: number, evaluation: PoseEvaluation | null) => {
        const errorJoints = new Set<number>();
        if (evaluation && evaluation.highlight_joints) {
            evaluation.highlight_joints.forEach((jointName) => {
                const idx = LM_MAP[jointName];
                if (idx !== undefined) errorJoints.add(idx);
            });
        }

        const isOverallCorrect = evaluation?.status === 'correct';
        const baseColor = isOverallCorrect ? '#10b981' : '#3b82f6'; // Emerald or Blue
        const errColor = '#ef4444'; // Red

        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        // Draw connections
        for (const [a, b] of POSE_CONNECTIONS) {
            const la = landmarks[a], lb = landmarks[b];
            if (!la || !lb || la.visibility < 0.3 || lb.visibility < 0.3) continue;

            const isErr = errorJoints.has(a) || errorJoints.has(b);
            ctx.strokeStyle = isErr ? errColor : baseColor;
            
            ctx.beginPath();
            ctx.moveTo(la.x * w, la.y * h);
            ctx.lineTo(lb.x * w, lb.y * h);
            ctx.stroke();
        }

        // Draw joints
        for (let i = 0; i < landmarks.length; i++) {
            const lm = landmarks[i];
            if (!lm || lm.visibility < 0.3) continue;
            
            const isErr = errorJoints.has(i);
            
            ctx.beginPath();
            ctx.arc(lm.x * w, lm.y * h, 6, 0, 2 * Math.PI);
            ctx.fillStyle = isErr ? errColor : '#ffffff';
            ctx.fill();
            
            ctx.strokeStyle = isErr ? '#991b1b' : baseColor;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    };

    const lastTs = useRef(0);

    const onResults = useCallback((results: any) => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!results.poseLandmarks) return;
        const landmarks: Point3D[] = results.poseLandmarks;

        // Throttle WS sending to ~30fps (33ms) for fast real-time feedback
        const now = Date.now();
        if (now - lastTs.current > 33) {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                // We'll read from simple DOM inputs for settings to bypass react closures, or use tolerance from scope
                const payload = {
                    landmarks: landmarks.map(l => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility })),
                    tolerance: document.getElementById("yoga-toler-select")?.getAttribute("data-value") || tolerance,
                };
                wsRef.current.send(JSON.stringify(payload));
            } else if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
                setupWebSocket(); // Reconnect if closed
            }
            lastTs.current = now;
        }

        // Ensure we draw using latest evaluation state ref-wise if needed, but state update might lag 1 frame.
        // We'll just use the latest evalData from state scope. 
        // Note: For true real-time, `evalData` should be tracked in a ref, but state is okay here since we mainly draw visuals.
        
        // Actually, to avoid closure issues with evalData, we should use a ref for drawing.
        // But let's just access through setEvalData's state trick, or ignore for now since re-render updates `evalData`.
    }, []);

    // Update draw loop whenever evalData changes to reflect current highlight joints properly inside onResults.
    // Instead of messing with closures, we'll draw inside useEffect tracking results? No, MediaPipe loop is distinct.
    const currentEvalRef = useRef<PoseEvaluation | null>(null);
    useEffect(() => {
        currentEvalRef.current = evalData;
    }, [evalData]);

    const drawFromResults = useCallback((results: any) => {
        onResults(results);
        const canvas = canvasRef.current;
        if (canvas) {
           const ctx = canvas.getContext('2d');
           if (ctx && results.poseLandmarks) {
               drawSkeleton(ctx, results.poseLandmarks, canvas.width, canvas.height, currentEvalRef.current);
           }
        }
    }, [onResults]);


    const startMonitor = async () => {
        if (!scriptsLoaded) return;
        const win = window as any;
        if (!win.Pose || !win.Camera) return;

        setupWebSocket();

        try {
            const pose = new win.Pose({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
            pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
            pose.onResults(drawFromResults);
            poseRef.current = pose;
            
            const camera = new win.Camera(videoRef.current!, {
                onFrame: async () => { await pose.send({ image: videoRef.current! }); },
                width: 640, height: 480,
            });
            camera.start();
            cameraRef.current = camera;
            setIsRunning(true);
        } catch (e: any) {
            setError('Camera failed: ' + e.message);
        }
    };

    return (
        <div className="mt-6 animate-fade-in text-white w-full max-w-6xl mx-auto">
            {/* Control Panel Header */}
            <div className="bg-[#0f172a] border border-slate-700/50 rounded-2xl p-6 shadow-xl mb-6 flex flex-col md:flex-row gap-6 justify-between items-center bg-gradient-to-br from-slate-900 to-indigo-950/20">
                <div>
                    <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-indigo-400">
                        AI Yoga Guru
                    </h2>
                    <p className="text-slate-400 mt-2 text-sm font-medium">Real-time biomechanical analysis and form correction.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    {/* Hidden inputs used as data stores for the mediapipe closure */}
                    <div id="yoga-toler-select" data-value={tolerance} style={{ display: 'none' }} />

                    <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1 mb-1">Difficulty</label>
                        <select 
                            value={tolerance}
                            onChange={(e) => setTolerance(e.target.value as SkillLevel)}
                            className="bg-slate-800/80 border border-slate-600 text-white text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-teal-500 outline-none w-full sm:w-40 appearance-none transition-all"
                        >
                            <option value="Beginner">Beginner (±20°)</option>
                            <option value="Intermediate">Intermediate (±10°)</option>
                            <option value="Expert">Expert (±5°)</option>
                        </select>
                    </div>
                    
                    <div className="flex items-end">
                        {!isRunning ? (
                            <button onClick={startMonitor} disabled={!scriptsLoaded} className="h-[42px] px-6 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed">
                                {scriptsLoaded ? 'Begin Practice' : 'Loading ML...'}
                            </button>
                        ) : (
                            <button onClick={stopMonitor} className="h-[42px] px-6 bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white font-bold rounded-xl transition-all flex items-center justify-center">
                                End Practice
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 bg-red-900/30 border border-red-500/50 text-red-300 p-4 rounded-xl flex items-center gap-3">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Main Viewport */}
                <div className="lg:col-span-2 relative bg-[#09090b] rounded-[24px] border border-slate-800 overflow-hidden shadow-2xl aspect-video group">
                    <video ref={videoRef} id="yoga-monitor-video" className="absolute inset-0 w-full h-full object-cover -scale-x-100" autoPlay muted playsInline />
                    {/* Canvas also needs -scale-x-100 if we want it to match mirrored video, but MediaPipe draws un-mirrored by default.
                        Wait, camera_utils draws on video. If video is mirrored via CSS, we must mirror canvas via CSS. */}
                    <canvas ref={canvasRef} id="yoga-monitor-canvas" className="absolute inset-0 w-full h-full object-cover -scale-x-100" />
                    
                    {!isRunning && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                            <div className="w-20 h-20 rounded-full bg-teal-500/20 flex items-center justify-center mb-4">
                                <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </div>
                            <p className="text-xl font-bold">Camera Offline</p>
                            <p className="text-sm text-slate-400 mt-2">Click Begin Practice to activate AI Tracking.</p>
                        </div>
                    )}
                    
                    {/* Live Indicator Overlay */}
                    {isRunning && (
                        <div className="absolute inset-x-0 top-0 p-6 flex justify-between items-start pointer-events-none">
                            <div className="bg-black/50 backdrop-blur-md rounded-xl px-4 py-2 border border-slate-700/50 flex flex-col items-center shadow-lg">
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Detected Pose</span>
                                <span className="text-sm font-bold text-teal-300">{evalData?.pose || 'Detecting...'}</span>
                            </div>
                            <div className="bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5 border border-slate-700/50 flex items-center gap-2 shadow-lg">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-xs font-bold tracking-wider">LIVE</span>
                            </div>
                        </div>
                    )}

                    {/* Full Coverage Confetti / Success Overlay logic */}
                    {isRunning && evalData?.status === 'correct' && (
                        <div className="absolute inset-0 border-4 border-emerald-500/50 rounded-[24px] pointer-events-none animate-pulse" />
                    )}
                </div>

                {/* Cyber HUD Side Panel */}
                <div className="flex flex-col gap-4">
                    
                    {/* Accuracy Score */}
                    <div className="bg-slate-900 border border-slate-800 rounded-[20px] p-6 shadow-lg relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl" />
                        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">Accuracy Score</h3>
                        
                        <div className="flex items-end gap-3">
                            <span className={`text-6xl font-black tabular-nums tracking-tighter ${evalData?.status === 'correct' ? 'text-emerald-400' : 'text-white'}`}>
                                {evalData ? evalData.accuracy.toFixed(0) : '0'}
                            </span>
                            <span className="text-xl text-slate-500 mb-1 font-bold">%</span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-slate-800 rounded-full mt-6 overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-300 ${evalData?.status === 'correct' ? 'bg-emerald-500' : 'bg-teal-500'}`}
                                style={{ width: `${evalData?.accuracy || 0}%` }}
                            />
                        </div>
                    </div>

                    {/* Dynamic Feedback Card */}
                    <div className={`flex-1 min-h-[200px] border rounded-[20px] p-6 shadow-lg transition-colors duration-500 ${
                        !isRunning ? 'bg-slate-900 border-slate-800' :
                        evalData?.status === 'correct' ? 'bg-emerald-950/30 border-emerald-500/30' :
                        evalData?.status === 'incorrect' ? 'bg-amber-950/30 border-amber-500/30' :
                        'bg-slate-900 border-slate-800'
                    }`}>
                        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4 flex items-center justify-between">
                            AI Feedback
                            {evalData?.status === 'correct' && <span className="text-emerald-400">Perfect Form</span>}
                            {evalData?.status === 'incorrect' && <span className="text-amber-400">Needs Adj</span>}
                        </h3>

                        {!isRunning && (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 pt-8 pb-4">
                                <svg className="w-12 h-12 mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                <p className="text-sm">Feedback stream will appear here.</p>
                            </div>
                        )}

                        {isRunning && (!evalData || (evalData.feedback.length === 0 && evalData.status !== 'correct')) && (
                            <div className="flex items-center gap-3 pt-4 opacity-75">
                                <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm">Analyzing biomechanics...</span>
                            </div>
                        )}

                        {isRunning && evalData?.status === 'correct' && (
                            <div className="pt-4 flex items-center gap-4 text-emerald-400">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <p className="text-sm font-medium leading-relaxed">Excellent alignment! Maintain your breath and hold the pose steady.</p>
                            </div>
                        )}

                        {isRunning && evalData?.feedback && evalData.feedback.length > 0 && (
                            <ul className="space-y-4 pt-2">
                                {evalData.feedback.map((msg, i) => (
                                    <li key={i} className="flex gap-3 text-amber-200">
                                        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-xs font-bold text-amber-500">!</span>
                                        </div>
                                        <p className="text-sm leading-relaxed">{msg}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Pro Tips Panel */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-[20px] p-5 shadow-lg">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                            <div>
                                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">Session Tip</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">Voice guidance is enabled. Adjust your posture based on the glowing red joint highlights on the skeleton overlay.</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default YogaPoseDetector;
