import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';

export interface HyperspeedOptions {
    onSpeedUp?: () => void;
    onSlowDown?: () => void;
    distortion?: 'turbulentDistortion' | 'mountainDistortion' | 'xyDistortion' | 'LongRaceDistortion' | 'deepDistortion' | 'none';
    length?: number;
    roadWidth?: number;
    islandWidth?: number;
    lanesPerRoad?: number;
    fov?: number;
    fovSpeedUp?: number;
    speedUp?: number;
    carLightsFade?: number;
    totalSideLightSticks?: number;
    lightPairsPerRoadWay?: number;
    shoulderLinesWidthPercentage?: number;
    brokenLinesWidthPercentage?: number;
    brokenLinesLengthPercentage?: number;
    lightStickWidth?: [number, number];
    lightStickHeight?: [number, number];
    movingAwaySpeed?: [number, number];
    movingCloserSpeed?: [number, number];
    carLightsLength?: [number, number];
    carLightsRadius?: [number, number];
    carWidthPercentage?: [number, number];
    carShiftX?: [number, number];
    carFloorSeparation?: [number, number];
    colors?: {
        roadColor: number;
        islandColor: number;
        background: number;
        shoulderLines: number;
        brokenLines: number;
        leftCars: number[];
        rightCars: number[];
        sticks: number;
    };
}

export interface HyperspeedProps {
    effectOptions?: HyperspeedOptions;
    className?: string;
}

const DEFAULT_OPTIONS: HyperspeedOptions = {
    onSpeedUp: () => { },
    onSlowDown: () => { },
    distortion: 'turbulentDistortion',
    length: 400,
    roadWidth: 10,
    islandWidth: 2,
    lanesPerRoad: 4,
    fov: 90,
    fovSpeedUp: 150,
    speedUp: 2,
    carLightsFade: 0.4,
    totalSideLightSticks: 20,
    lightPairsPerRoadWay: 40,
    shoulderLinesWidthPercentage: 0.05,
    brokenLinesWidthPercentage: 0.1,
    brokenLinesLengthPercentage: 0.5,
    lightStickWidth: [0.12, 0.5],
    lightStickHeight: [1.3, 1.7],
    movingAwaySpeed: [60, 80],
    movingCloserSpeed: [-120, -160],
    carLightsLength: [400 * 0.03, 400 * 0.2],
    carLightsRadius: [0.05, 0.14],
    carWidthPercentage: [0.3, 0.5],
    carShiftX: [-0.8, 0.8],
    carFloorSeparation: [0, 5],
    colors: {
        roadColor: 0x080808,
        islandColor: 0x0a0a0a,
        background: 0x000000,
        shoulderLines: 0xFFFFFF,
        brokenLines: 0xFFFFFF,
        leftCars: [0xD856BF, 0x6750A2, 0xC247AC],
        rightCars: [0x03B3C3, 0x0E5EA5, 0x324555],
        sticks: 0x03B3C3,
    }
};

export const Hyperspeed = forwardRef<HTMLDivElement, HyperspeedProps>(({ effectOptions, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => containerRef.current!);

    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;

        const options = { ...DEFAULT_OPTIONS, ...effectOptions };
        const colors = { ...DEFAULT_OPTIONS.colors, ...effectOptions?.colors };

        // Internal state for animation
        const state = {
            speed: 1,
            targetSpeed: 1,
            fov: options.fov || 90,
            targetFov: options.fov || 90,
        };

        // Three.js setup
        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: true,
            alpha: true
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(colors.background);

        const camera = new THREE.PerspectiveCamera(state.fov, 1, 0.1, 10000);
        camera.position.z = 10;
        camera.position.y = 7;

        const resize = () => {
            const width = containerRef.current!.clientWidth;
            const height = containerRef.current!.clientHeight;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };

        window.addEventListener('resize', resize);
        resize();

        // Create Geometry & Materials
        const count = 2000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3 * 2);
        const lineColors = new Float32Array(count * 3 * 2);

        for (let i = 0; i < count; i++) {
            const z = Math.random() * options.length!;
            const r = options.roadWidth! + Math.random() * 20;
            const theta = Math.random() * Math.PI * 2;

            const x = Math.cos(theta) * r;
            const y = Math.sin(theta) * r;

            const idx = i * 6;
            positions[idx] = x;
            positions[idx + 1] = y;
            positions[idx + 2] = -z;

            positions[idx + 3] = x;
            positions[idx + 4] = y;
            positions[idx + 5] = -(z + 10 + Math.random() * 50);

            const colorSet = i % 2 === 0 ? colors.leftCars : colors.rightCars;
            const chosenColor = new THREE.Color(colorSet[Math.floor(Math.random() * colorSet.length)]);

            lineColors[idx] = chosenColor.r;
            lineColors[idx + 1] = chosenColor.g;
            lineColors[idx + 2] = chosenColor.b;

            lineColors[idx + 3] = chosenColor.r;
            lineColors[idx + 4] = chosenColor.g;
            lineColors[idx + 5] = chosenColor.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const lines = new THREE.LineSegments(geometry, material);
        scene.add(lines);

        // Distortion logic
        const applyDistortion = (time: number) => {
            const pos = geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < count; i++) {
                const idx = i * 6;
                // Moving lines
                pos[idx + 2] += state.speed * 1.5;
                pos[idx + 5] += state.speed * 1.5;

                // Reset if passed
                if (pos[idx + 2] > 50) {
                    const newZ = options.length!;
                    const length = 10 + Math.random() * 50;
                    pos[idx + 2] = -newZ;
                    pos[idx + 5] = -(newZ + length);
                }

                // Apply distortion based on type
                if (options.distortion === 'turbulentDistortion') {
                    const offset = Math.sin(time * 0.001 + pos[idx + 2] * 0.01) * 2;
                    pos[idx] += offset * 0.01;
                    pos[idx + 3] += offset * 0.01;
                } else if (options.distortion === 'mountainDistortion') {
                    const offset = Math.cos(pos[idx + 2] * 0.005) * 5;
                    pos[idx + 1] += offset * 0.01;
                    pos[idx + 4] += offset * 0.01;
                }
            }
            geometry.attributes.position.needsUpdate = true;
        };

        // Animation Loop
        let animationId: number;
        const animate = (time: number) => {
            animationId = requestAnimationFrame(animate);

            // Speed interpolation
            state.speed += (state.targetSpeed - state.speed) * 0.05;
            state.fov += (state.targetFov - state.fov) * 0.05;

            camera.fov = state.fov;
            camera.updateProjectionMatrix();

            applyDistortion(time);

            renderer.render(scene, camera);
        };

        animate(0);

        // Interaction handlers
        const handleMouseDown = () => {
            state.targetSpeed = options.speedUp!;
            state.targetFov = options.fovSpeedUp!;
            options.onSpeedUp?.();
        };

        const handleMouseUp = () => {
            state.targetSpeed = 1;
            state.targetFov = options.fov!;
            options.onSlowDown?.();
        };

        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchstart', handleMouseDown);
        window.addEventListener('touchend', handleMouseUp);

        // Cleanup
        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchstart', handleMouseDown);
            window.removeEventListener('touchend', handleMouseUp);
            cancelAnimationFrame(animationId);
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, [effectOptions]);

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full overflow-hidden ${className || ''}`}
        >
            <canvas
                ref={canvasRef}
                className="block w-full h-full"
            />
        </div>
    );
});

export default Hyperspeed;

export const hyperspeedPresets = {
    one: {
        distortion: 'turbulentDistortion' as const,
        length: 400,
        roadWidth: 10,
        islandWidth: 2,
        lanesPerRoad: 3,
        fov: 90,
        fovSpeedUp: 150,
        speedUp: 2,
        colors: {
            roadColor: 0x080808,
            islandColor: 0x0a0a0a,
            background: 0x000000,
            shoulderLines: 0x131318,
            brokenLines: 0x131318,
            leftCars: [0xd856bf, 0x6750a2, 0xc247ac],
            rightCars: [0x03b3c3, 0x0e5ea5, 0x324555],
            sticks: 0x03b3c3
        }
    },
    two: {
        distortion: 'mountainDistortion' as const,
        length: 400,
        roadWidth: 9,
        islandWidth: 2,
        lanesPerRoad: 3,
        fov: 90,
        fovSpeedUp: 150,
        speedUp: 2,
        colors: {
            roadColor: 0x080808,
            islandColor: 0x0a0a0a,
            background: 0x000000,
            shoulderLines: 0x131318,
            brokenLines: 0x131318,
            leftCars: [0xff102a, 0xeb383e, 0xff102a],
            rightCars: [0xdadafa, 0xbebae3, 0x8f97e4],
            sticks: 0xdadafa
        }
    },
    three: {
        distortion: 'xyDistortion' as const,
        length: 400,
        roadWidth: 9,
        islandWidth: 2,
        lanesPerRoad: 3,
        fov: 90,
        fovSpeedUp: 150,
        speedUp: 3,
        colors: {
            roadColor: 0x080808,
            islandColor: 0x0a0a0a,
            background: 0x000000,
            shoulderLines: 0x131318,
            brokenLines: 0x131318,
            leftCars: [0x7d0d1b, 0xa90519, 0xff102a],
            rightCars: [0xf1eece, 0xe6e2b1, 0xdfd98a],
            sticks: 0xf1eece
        }
    },
    four: {
        distortion: 'LongRaceDistortion' as const,
        length: 400,
        roadWidth: 10,
        islandWidth: 5,
        lanesPerRoad: 2,
        fov: 90,
        fovSpeedUp: 150,
        speedUp: 2,
        colors: {
            roadColor: 0x080808,
            islandColor: 0x0a0a0a,
            background: 0x000000,
            shoulderLines: 0x131318,
            brokenLines: 0x131318,
            leftCars: [0xff5f73, 0xe74d60, 0xff102a],
            rightCars: [0xa4e3e6, 0x80d1d4, 0x53c2c6],
            sticks: 0xa4e3e6
        }
    },
    five: {
        distortion: 'turbulentDistortion' as const,
        length: 400,
        roadWidth: 9,
        islandWidth: 2,
        lanesPerRoad: 3,
        fov: 90,
        fovSpeedUp: 150,
        speedUp: 2,
        colors: {
            roadColor: 0x080808,
            islandColor: 0x0a0a0a,
            background: 0x000000,
            shoulderLines: 0x131318,
            brokenLines: 0x131318,
            leftCars: [0xdc5b20, 0xdca320, 0xdc2020],
            rightCars: [0x334bf7, 0xe5e6ed, 0xbfc6f3],
            sticks: 0xc5e8eb
        }
    },
    six: {
        distortion: 'deepDistortion' as const,
        length: 400,
        roadWidth: 18,
        islandWidth: 2,
        lanesPerRoad: 3,
        fov: 90,
        fovSpeedUp: 150,
        speedUp: 2,
        colors: {
            roadColor: 0x080808,
            islandColor: 0x0a0a0a,
            background: 0x000000,
            shoulderLines: 0x131318,
            brokenLines: 0x131318,
            leftCars: [0xff322f, 0xa33010, 0xa81508],
            rightCars: [0xfdfdf0, 0xf3dea0, 0xe2bb88],
            sticks: 0xfdfdf0
        }
    }
};
