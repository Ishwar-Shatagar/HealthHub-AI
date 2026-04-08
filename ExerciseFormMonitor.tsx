import React, { useEffect, useRef, useState, useCallback } from 'react';

// Types
type ExerciseType = 'squat' | 'pushup' | 'curl';
type PostureQuality = 'Correct' | 'Minor Issues' | 'Incorrect';
type RiskLevel = 'Low' | 'Moderate' | 'High';
type RepPhase = 'up' | 'down';

interface FormState {
    posture: PostureQuality;
    feedback: string[];
    risk: RiskLevel;
    reps: number;
    angle1: number | null;
    angle2: number | null;
}

interface Landmark {
    x: number;
    y: number;
    z: number;
    visibility: number;
}

// MediaPipe Landmark Indices
const LM = {
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
    LEFT_WRIST: 15, RIGHT_WRIST: 16,
    LEFT_HIP: 23, RIGHT_HIP: 24,
    LEFT_KNEE: 25, RIGHT_KNEE: 26,
    LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

// Skeleton connections
const POSE_CONNECTIONS: [number, number][] = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27], [24, 26], [26, 28],
];

// Compute angle at joint B given three landmarks A-B-C
function calculateAngle(A: Landmark, B: Landmark, C: Landmark): number {
    const rad = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let angle = Math.abs((rad * 180) / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return angle;
}

function avg(a: Landmark, b: Landmark): Landmark {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: Math.min(a.visibility, b.visibility) };
}

function vis(lm: Landmark): boolean {
    return lm.visibility >= 0.4;
}

// Squat analysis
function analyzeSquat(lms: Landmark[]): Omit<FormState, 'reps'> {
    const lHip = lms[LM.LEFT_HIP], lKnee = lms[LM.LEFT_KNEE], lAnkle = lms[LM.LEFT_ANKLE];
    const rHip = lms[LM.RIGHT_HIP], rKnee = lms[LM.RIGHT_KNEE], rAnkle = lms[LM.RIGHT_ANKLE];
    const lShoulder = lms[LM.LEFT_SHOULDER], rShoulder = lms[LM.RIGHT_SHOULDER];

    if (!vis(lHip) || !vis(lKnee) || !vis(lAnkle) || !vis(rHip) || !vis(rKnee) || !vis(rAnkle)) {
        return { posture: 'Minor Issues', feedback: ['Step back so full body is visible'], risk: 'Low', angle1: null, angle2: null };
    }

    const kneeAngle = (calculateAngle(lHip, lKnee, lAnkle) + calculateAngle(rHip, rKnee, rAnkle)) / 2;
    let backAngle = 180;
    if (vis(lShoulder) && vis(rShoulder)) {
        backAngle = calculateAngle(avg(lShoulder, rShoulder), avg(lHip, rHip), lKnee);
    }
    const kneeValgus = Math.abs(lAnkle.x - rAnkle.x) > 0 && Math.abs(lKnee.x - rKnee.x) < Math.abs(lAnkle.x - rAnkle.x) * 0.6;

    const feedback: string[] = [];
    let posture: PostureQuality = 'Correct';
    let risk: RiskLevel = 'Low';

    if (kneeValgus) { feedback.push('Push knees outward - align with toes'); posture = 'Incorrect'; risk = 'High'; }
    if (backAngle < 150) { feedback.push('Keep chest up - avoid rounding back'); posture = 'Incorrect'; risk = 'High'; }
    if (kneeAngle > 120) {
        if (posture === 'Correct') posture = 'Minor Issues';
        feedback.push('Go deeper - bend knees more');
        if (risk === 'Low') risk = 'Moderate';
    }
    return { posture, feedback, risk, angle1: Math.round(kneeAngle), angle2: Math.round(backAngle) };
}

// Push-up analysis
function analyzePushup(lms: Landmark[]): Omit<FormState, 'reps'> {
    const lS = lms[LM.LEFT_SHOULDER], rS = lms[LM.RIGHT_SHOULDER];
    const lE = lms[LM.LEFT_ELBOW], rE = lms[LM.RIGHT_ELBOW];
    const lW = lms[LM.LEFT_WRIST], rW = lms[LM.RIGHT_WRIST];
    const lH = lms[LM.LEFT_HIP], rH = lms[LM.RIGHT_HIP];
    const lK = lms[LM.LEFT_KNEE], rK = lms[LM.RIGHT_KNEE];

    if (!vis(lS) || !vis(lE) || !vis(lW)) {
        return { posture: 'Minor Issues', feedback: ['Ensure upper body is clearly visible'], risk: 'Low', angle1: null, angle2: null };
    }

    const elbowAngle = (calculateAngle(lS, lE, lW) + calculateAngle(rS, rE, rW)) / 2;
    let backAngle = 180;
    if (vis(lH) && vis(rH) && vis(lK)) {
        backAngle = calculateAngle(avg(lS, rS), avg(lH, rH), avg(lK, rK));
    }

    const feedback: string[] = [];
    let posture: PostureQuality = 'Correct';
    let risk: RiskLevel = 'Low';

    if (backAngle < 160) { feedback.push('Engage core - hips are sagging'); posture = 'Incorrect'; risk = 'High'; }
    if (elbowAngle > 160) {
        if (posture === 'Correct') posture = 'Minor Issues';
        feedback.push('Lower more - bend elbows fully');
        if (risk === 'Low') risk = 'Moderate';
    }
    return { posture, feedback, risk, angle1: Math.round(elbowAngle), angle2: Math.round(backAngle) };
}

// Bicep curl analysis
function analyzeCurl(lms: Landmark[]): Omit<FormState, 'reps'> {
    const lS = lms[LM.LEFT_SHOULDER], rS = lms[LM.RIGHT_SHOULDER];
    const lE = lms[LM.LEFT_ELBOW], rE = lms[LM.RIGHT_ELBOW];
    const lW = lms[LM.LEFT_WRIST], rW = lms[LM.RIGHT_WRIST];

    if (!vis(lS) || !vis(lE) || !vis(lW)) {
        return { posture: 'Minor Issues', feedback: ['Ensure full arm is visible'], risk: 'Low', angle1: null, angle2: null };
    }

    const elbowAngle = (calculateAngle(lS, lE, lW) + calculateAngle(rS, rE, rW)) / 2;
    const shoulderDrift = Math.abs(lS.x - rS.x);
    const elbowDrift = Math.abs(lE.x - rE.x);
    const swinging = shoulderDrift > 0 && Math.abs(elbowDrift - shoulderDrift) / shoulderDrift > 0.15;

    const feedback: string[] = [];
    let posture: PostureQuality = 'Correct';
    let risk: RiskLevel = 'Low';

    if (swinging) { if (posture === 'Correct') posture = 'Minor Issues'; feedback.push('Keep upper arm still - avoid swinging'); if (risk === 'Low') risk = 'Moderate'; }
    if (elbowAngle > 140) { if (posture === 'Correct') posture = 'Minor Issues'; feedback.push('Curl fully - squeeze bicep at top'); }

    return { posture, feedback, risk, angle1: Math.round(elbowAngle), angle2: null };
}

function analyzeForm(exercise: ExerciseType, lms: Landmark[]): Omit<FormState, 'reps'> {
    if (exercise === 'squat') return analyzeSquat(lms);
    if (exercise === 'pushup') return analyzePushup(lms);
    return analyzeCurl(lms);
}

// Draw skeleton on canvas
function drawSkeleton(ctx: CanvasRenderingContext2D, lms: Landmark[], w: number, h: number, posture: PostureQuality) {
    const color = posture === 'Correct' ? '#22c55e' : posture === 'Minor Issues' ? '#f59e0b' : '#ef4444';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const [a, b] of POSE_CONNECTIONS) {
        const la = lms[a], lb = lms[b];
        if (!la || !lb || la.visibility < 0.3 || lb.visibility < 0.3) continue;
        ctx.beginPath(); ctx.moveTo(la.x * w, la.y * h); ctx.lineTo(lb.x * w, lb.y * h); ctx.stroke();
    }
    for (const lm of lms) {
        if (!lm || lm.visibility < 0.3) continue;
        ctx.beginPath(); ctx.arc(lm.x * w, lm.y * h, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    }
}

// Exercise configuration
const EXERCISE_CONFIG: Record<ExerciseType, { label: string; emoji: string; angle1Label: string; angle2Label: string | null; tip: string }> = {
    squat: { label: 'Squat', emoji: '\uD83C\uDFCB\uFE0F', angle1Label: 'Knee', angle2Label: 'Back', tip: 'Stand sideways to the camera, full body visible.' },
    pushup: { label: 'Push-up', emoji: '\uD83D\uDCAA', angle1Label: 'Elbow', angle2Label: 'Back', tip: 'Position camera to your side at floor level.' },
    curl: { label: 'Bicep Curl', emoji: '\uD83E\uDDBE', angle1Label: 'Elbow', angle2Label: null, tip: 'Face the camera with arms fully visible.' },
};

// Main Component
const ExerciseFormMonitor: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [exercise, setExercise] = useState<ExerciseType>('squat');
    const [formState, setFormState] = useState<FormState>({ posture: 'Correct', feedback: [], risk: 'Low', reps: 0, angle1: null, angle2: null });
    const [isRunning, setIsRunning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);

    const repPhaseRef = useRef<RepPhase>('up');
    const repCountRef = useRef(0);
    const lastFeedbackRef = useRef('');
    const poseRef = useRef<any>(null);
    const cameraRef = useRef<any>(null);

    // Load MediaPipe scripts from CDN
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

    useEffect(() => {
        repCountRef.current = 0; repPhaseRef.current = 'up'; lastFeedbackRef.current = '';
        setFormState(f => ({ ...f, reps: 0, feedback: [], posture: 'Correct', risk: 'Low' }));
    }, [exercise]);

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

        const lms: Landmark[] = results.poseLandmarks;
        const analysis = analyzeForm(exercise, lms);

        // Rep counting
        const angle = analysis.angle1;
        let newReps = repCountRef.current;
        if (angle !== null) {
            const isDown = exercise === 'squat' ? angle < 110 : exercise === 'pushup' ? angle < 100 : angle < 60;
            if (isDown && repPhaseRef.current === 'up') { repPhaseRef.current = 'down'; }
            else if (!isDown && repPhaseRef.current === 'down') { repPhaseRef.current = 'up'; newReps++; repCountRef.current = newReps; }
        }
        const feedbackStr = analysis.feedback.join('|');
        if (feedbackStr !== lastFeedbackRef.current) lastFeedbackRef.current = feedbackStr;
        setFormState({ ...analysis, reps: newReps });
        drawSkeleton(ctx, lms, canvas.width, canvas.height, analysis.posture);
    }, [exercise]);

    const startMonitor = useCallback(async () => {
        if (!scriptsLoaded) { setError('MediaPipe still loading, please wait...'); return; }
        const win = window as any;
        if (!win.Pose || !win.Camera) { setError('MediaPipe not ready. Refresh and try again.'); return; }
        setIsLoading(true); setError(null);
        try {
            const pose = new win.Pose({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
            pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
            pose.onResults(onResults);
            poseRef.current = pose;
            const camera = new win.Camera(videoRef.current!, {
                onFrame: async () => { await pose.send({ image: videoRef.current! }); },
                width: 640, height: 480,
            });
            camera.start();
            cameraRef.current = camera;
            setIsRunning(true);
        } catch (e: any) {
            setError('Camera error: ' + (e?.message || 'Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, [scriptsLoaded, onResults]);

    const stopMonitor = useCallback(() => {
        if (cameraRef.current) { cameraRef.current.stop(); cameraRef.current = null; }
        if (poseRef.current) { poseRef.current.close(); poseRef.current = null; }
        const canvas = canvasRef.current;
        if (canvas) { const ctx = canvas.getContext('2d'); ctx?.clearRect(0, 0, canvas.width, canvas.height); }
        setIsRunning(false);
        repCountRef.current = 0; repPhaseRef.current = 'up';
        setFormState({ posture: 'Correct', feedback: [], risk: 'Low', reps: 0, angle1: null, angle2: null });
    }, []);

    useEffect(() => () => { stopMonitor(); }, [stopMonitor]);

    const postureColors: Record<PostureQuality, string> = {
        'Correct': 'text-green-400 bg-green-900/30 border-green-500',
        'Minor Issues': 'text-yellow-400 bg-yellow-900/30 border-yellow-500',
        'Incorrect': 'text-red-400 bg-red-900/30 border-red-500',
    };
    const riskColors: Record<RiskLevel, string> = {
        Low: 'text-green-300 bg-green-900/20',
        Moderate: 'text-yellow-300 bg-yellow-900/20',
        High: 'text-red-300 bg-red-900/20',
    };
    const postureEmoji: Record<PostureQuality, string> = { 'Correct': '\u2705', 'Minor Issues': '\u26A0\uFE0F', 'Incorrect': '\u274C' };

    const cfg = EXERCISE_CONFIG[exercise];

    return (
        <div className="mt-6 animate-fade-in">
            {/* Header */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">AI Form Monitor</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Real-time posture analysis via webcam</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {(Object.entries(EXERCISE_CONFIG) as [ExerciseType, typeof cfg][]).map(([key, val]) => (
                        <button
                            key={key}
                            onClick={() => setExercise(key)}
                            disabled={isRunning}
                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${exercise === key ? 'bg-green-600 text-white border-green-600 shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'} disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                            {val.emoji} {val.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Video Feed */}
                <div className="lg:col-span-2">
                    <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video shadow-2xl border border-gray-700">
                        <video ref={videoRef} id="form-monitor-video" className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
                        <canvas ref={canvasRef} id="form-monitor-canvas" className="absolute inset-0 w-full h-full object-cover" />

                        {!isRunning && !isLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 text-center px-6">
                                <div className="text-6xl mb-4">{cfg.emoji}</div>
                                <p className="text-white text-lg font-semibold mb-1">{cfg.label} Form Monitor</p>
                                <p className="text-gray-400 text-sm mb-6">{cfg.tip}</p>
                                <button
                                    onClick={startMonitor}
                                    disabled={!scriptsLoaded}
                                    className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-105 text-sm"
                                >
                                    {scriptsLoaded ? 'Start Monitoring' : 'Loading MediaPipe...'}
                                </button>
                            </div>
                        )}

                        {isLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80">
                                <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
                                <p className="text-white text-sm">Initializing camera...</p>
                            </div>
                        )}

                        {isRunning && (
                            <div className="absolute top-3 left-3 flex items-center space-x-2 bg-black/60 rounded-full px-3 py-1">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-white text-xs font-bold">LIVE</span>
                            </div>
                        )}

                        {isRunning && formState.angle1 !== null && (
                            <div className="absolute bottom-3 left-3 flex gap-2">
                                <div className="bg-black/60 rounded-lg px-2 py-1 text-xs text-white">
                                    <span className="text-gray-400">{cfg.angle1Label}: </span>
                                    <span className="font-bold text-green-400">{formState.angle1}deg</span>
                                </div>
                                {cfg.angle2Label && formState.angle2 !== null && (
                                    <div className="bg-black/60 rounded-lg px-2 py-1 text-xs text-white">
                                        <span className="text-gray-400">{cfg.angle2Label}: </span>
                                        <span className="font-bold text-blue-400">{formState.angle2}deg</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-3 flex gap-3 justify-center">
                        {!isRunning ? (
                            <button onClick={startMonitor} disabled={isLoading || !scriptsLoaded} className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-all disabled:opacity-50">
                                {isLoading ? 'Starting...' : 'Start'}
                            </button>
                        ) : (
                            <button onClick={stopMonitor} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-all">
                                Stop
                            </button>
                        )}
                    </div>
                </div>

                {/* HUD Panel */}
                <div className="flex flex-col gap-3">
                    {/* Posture */}
                    <div className={`rounded-xl border-2 p-4 transition-all ${isRunning ? postureColors[formState.posture] : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-gray-500'}`}>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-1 opacity-70">Posture</p>
                        <p className="text-2xl font-black">
                            {isRunning ? `${postureEmoji[formState.posture]} ${formState.posture}` : '-- Idle'}
                        </p>
                    </div>

                    {/* Feedback */}
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Feedback</p>
                        {!isRunning || formState.feedback.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">
                                {isRunning ? 'Form looks good! Keep it up.' : 'Start monitoring to see feedback.'}
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {formState.feedback.map((f, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="text-yellow-500 mt-0.5">*</span>
                                        <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">{f}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Risk */}
                    <div className={`rounded-xl p-4 ${isRunning ? riskColors[formState.risk] : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Risk Level</p>
                        <p className="text-lg font-bold">
                            {isRunning ? (formState.risk === 'Low' ? 'Low' : formState.risk === 'Moderate' ? 'Moderate' : 'High') : '-- N/A'}
                        </p>
                    </div>

                    {/* Rep Counter */}
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Reps</p>
                        <span className="text-4xl font-black text-green-500 tabular-nums">{formState.reps}</span>
                    </div>

                    {/* Tip */}
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 p-3">
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Tip</p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">{cfg.tip}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExerciseFormMonitor;
