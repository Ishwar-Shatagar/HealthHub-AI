import React, { useEffect, useRef, useState } from 'react';
import { Hands, Results, Options } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

interface HandTrackingOverlayProps {
    onRotate: (dx: number, dy: number) => void;
    onZoom: (delta: number) => void;
    onResetView: () => void;
    onToggleView: () => void;
    isActive: boolean;
}

const HandTrackingOverlay: React.FC<HandTrackingOverlayProps> = ({
    onRotate,
    onZoom,
    onResetView,
    onToggleView,
    isActive
}) => {

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const lastHandPosRef = useRef<{ x: number, y: number } | null>(null);
    const callbacksRef = useRef({ onRotate, onZoom, onResetView, onToggleView });

    const [status, setStatus] = useState<'initializing' | 'active' | 'error'>('initializing');
    const [currentGestureName, setCurrentGestureName] = useState("none");

    const currentGestureRef = useRef("none");

    useEffect(() => {
        callbacksRef.current = { onRotate, onZoom, onResetView, onToggleView };
    }, [onRotate, onZoom, onResetView, onToggleView]);


    useEffect(() => {

        if (!isActive || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let camera: Camera | null = null;
        let hands: Hands | null = null;

        let lastPinchDist = 0;
        let lastActionTime = 0;

        let currentGesture = "none";
        let gestureFrames = 0;
        const requiredFrames = 2;

        const distance = (p1: any, p2: any) => {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const countFingers = (landmarks: any) => {

            let fingers = 0;

            const tips = [8, 12, 16, 20];
            const joints = [6, 10, 14, 18];

            for (let i = 0; i < 4; i++) {
                if (landmarks[tips[i]].y < landmarks[joints[i]].y) {
                    fingers++;
                }
            }

            return fingers;
        };

        const detectGesture = (landmarks: any) => {

            const fingers = countFingers(landmarks);

            const indexUp = landmarks[8].y < landmarks[6].y;
            const middleUp = landmarks[12].y < landmarks[10].y;
            const thumbUp = landmarks[4].y < landmarks[2].y;

            let gesture = "none";

            if (thumbUp && indexUp && distance(landmarks[4], landmarks[8]) < 0.1) {
                gesture = "zoom";
            }

            else if (fingers === 1 && indexUp) {
                gesture = "rotation";
            }

            else if (fingers === 0) {
                gesture = "closedPalm";
            }

            else if (fingers === 4) {
                gesture = "openPalm";
            }

            else if (fingers === 2 && indexUp && middleUp) {
                gesture = "peace";
            }

            return gesture;
        };


        const executeGesture = (gesture: string, landmarks: any, pinchDist: number) => {

            const indexTip = landmarks[8];
            const now = Date.now();

            const canTrigger = now - lastActionTime > 1500;

            if (currentGestureRef.current !== gesture) {
                currentGestureRef.current = gesture;
                setCurrentGestureName(gesture);

                lastHandPosRef.current = null;
                lastPinchDist = 0;
            }

            switch (gesture) {

                case "rotation":

                    if (!lastHandPosRef.current) {
                        lastHandPosRef.current = { x: indexTip.x, y: indexTip.y };
                    }

                    else {

                        const dx = -(indexTip.x - lastHandPosRef.current.x);
                        const dy = (indexTip.y - lastHandPosRef.current.y);

                        callbacksRef.current.onRotate(dx * 3, dy * 3);

                        lastHandPosRef.current = { x: indexTip.x, y: indexTip.y };
                    }

                    break;


                case "zoom":

                    if (lastPinchDist === 0) {
                        lastPinchDist = pinchDist;
                    }

                    else {

                        const delta = pinchDist - lastPinchDist;

                        callbacksRef.current.onZoom(-delta * 30);

                        lastPinchDist = pinchDist;
                    }

                    lastHandPosRef.current = null;

                    break;


                case "openPalm":

                    if (canTrigger) {
                        callbacksRef.current.onResetView();
                        lastActionTime = now;
                    }

                    lastHandPosRef.current = null;
                    lastPinchDist = 0;

                    break;


                case "peace":

                    if (canTrigger) {
                        callbacksRef.current.onToggleView();
                        lastActionTime = now;
                    }

                    lastHandPosRef.current = null;
                    lastPinchDist = 0;

                    break;


                case "closedPalm":

                    lastHandPosRef.current = null;
                    lastPinchDist = 0;

                    break;
            }

        };



        const init = async () => {

            try {

                hands = new Hands({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
                });

                const options: Options = {

                    maxNumHands: 1,
                    modelComplexity: 1,
                    minDetectionConfidence: 0.6,
                    minTrackingConfidence: 0.6

                };

                hands.setOptions(options);

                hands.onResults((results: Results) => {

                    ctx.save();
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {

                        setStatus("active");

                        const landmarks = results.multiHandLandmarks[0];

                        const detectedGesture = detectGesture(landmarks);

                        if (detectedGesture === currentGesture) {
                            gestureFrames++;
                        }

                        else {
                            currentGesture = detectedGesture;
                            gestureFrames = 1;
                        }

                        const pinchDist = distance(landmarks[4], landmarks[8]);

                        if (gestureFrames >= requiredFrames) {
                            executeGesture(currentGesture, landmarks, pinchDist);
                        }

                        else if (currentGesture !== "rotation") {
                            lastHandPosRef.current = null;
                        }

                        ctx.fillStyle = "#00ffff";

                        landmarks.forEach((lm: any) => {
                            ctx.beginPath();
                            ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3, 0, Math.PI * 2);
                            ctx.fill();
                        });

                    }

                    else {

                        lastHandPosRef.current = null;
                        lastPinchDist = 0;

                    }

                    ctx.restore();

                });


                camera = new Camera(video, {
                    onFrame: async () => {
                        if (hands) await hands.send({ image: video });
                    },
                    width: 320,
                    height: 240
                });

                await camera.start();

            }

            catch (e) {

                console.error(e);
                setStatus("error");

            }

        };

        init();

        return () => {
            if (camera) camera.stop();
            if (hands) hands.close();
        }

    }, [isActive]);


    if (!isActive) return null;


    return (

        <div className="absolute bottom-4 right-4 z-40 bg-black/50 p-2 rounded-2xl border border-sky-500/20 backdrop-blur-md overflow-hidden flex flex-col items-center">

            <h4 className="text-[10px] font-mono text-sky-400 mb-2 uppercase tracking-widest flex items-center gap-2">

                <div className={`w-2 h-2 rounded-full ${status === "active" ? "bg-green-400 animate-pulse" :
                        status === "error" ? "bg-red-500" :
                            "bg-yellow-500 animate-bounce"
                    }`} />

                Gesture Control

            </h4>

            <div className="relative w-32 h-24 rounded-lg overflow-hidden border border-white/10 opacity-70">

                <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
                    playsInline
                    muted
                />

                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full transform -scale-x-100 mix-blend-screen"
                    width={320}
                    height={240}
                />

            </div>

            <div className="text-[10px] font-mono text-white/40 mt-2 text-center leading-tight">

                Pinch to Zoom 🤏 <br />
                Move 1 Finger to Rotate ☝️ <br />
                Open Palm to Reset 🖐️ <br />
                Peace Sign to Toggle ✌️ <br />

                <span className="text-yellow-400 font-bold mt-1 block">
                    Active: {currentGestureName}
                </span>

            </div>

        </div>

    );

};

export default HandTrackingOverlay;