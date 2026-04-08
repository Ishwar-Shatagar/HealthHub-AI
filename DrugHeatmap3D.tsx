import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Sparkles, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
// @ts-ignore
// @ts-ignore
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { HeatmapEffect } from '../types';
import gsap from 'gsap';

// ─── Base color (matches Iron Man Hologram) ───────────────────────────────────
const BASE_COLOR = new THREE.Color('#00ffff');

// ─── Heatmap color: intensity → yellow (low) → orange → red (high) ───────────
function heatColor(t: number): THREE.Color {
    t = Math.max(0, Math.min(1, t));
    const c = new THREE.Color();
    if (t < 0.4) {
        // light yellow → orange
        c.setRGB(1.0, 1.0 - t * 0.5, 0.2 - t * 0.2);
    } else if (t < 0.75) {
        // orange → deep orange
        const s = (t - 0.4) / 0.35;
        c.setRGB(1.0, 0.8 - s * 0.45, 0.05);
    } else {
        // deep orange → red
        const s = (t - 0.75) / 0.25;
        c.setRGB(1.0, 0.35 - s * 0.35, 0.0);
    }
    return c;
}

function heatLabelColor(v: number) {
    if (v < 0.35) return { text: 'Low', hex: '#facc15' };
    if (v < 0.65) return { text: 'Moderate', hex: '#f97316' };
    return { text: 'High', hex: '#ef4444' };
}

// ─── Organ bounding-box zones (Y = bottom→top fraction of model) ──────────────
interface OrganZone {
    yMin: number; yMax: number;
    xMin?: number; xMax?: number; // normalized -0.5–0.5
}

const ORGAN_ZONES: Record<string, OrganZone> = {
    'Brain': { yMin: 0.88, yMax: 1.00 },
    'Nervous System': { yMin: 0.00, yMax: 1.00 },
    'Lungs': { yMin: 0.68, yMax: 0.83 },
    'Heart': { yMin: 0.70, yMax: 0.81, xMin: -0.18, xMax: 0.04 },
    'Liver': { yMin: 0.57, yMax: 0.71, xMin: 0.00, xMax: 0.22 },
    'Stomach': { yMin: 0.57, yMax: 0.69, xMin: -0.22, xMax: 0.04 },
    'Kidney': { yMin: 0.52, yMax: 0.66 },
    'Intestines': { yMin: 0.36, yMax: 0.56 },
    'Muscles': { yMin: 0.00, yMax: 1.00 },
    'Skin': { yMin: 0.00, yMax: 1.00 },
};

function norm(v: number, min: number, max: number) {
    const r = max - min;
    return r === 0 ? 0 : (v - min) / r;
}

const SKELETON_ZONES: Record<string, OrganZone> = {
    'Skull': { yMin: 0.88, yMax: 1.00 },
    'Spine': { yMin: 0.45, yMax: 0.88 },
    'Ribs': { yMin: 0.60, yMax: 0.85 },
    'Pelvis': { yMin: 0.40, yMax: 0.55 },
    'Femur': { yMin: 0.15, yMax: 0.45 },
    'Humerus': { yMin: 0.60, yMax: 0.80 },
};

const ORGAN_ICONS: Record<string, string> = {
    'Brain': '🧠', 'Heart': '❤️', 'Liver': '🟤', 'Kidney': '🫘',
    'Lungs': '💨', 'Stomach': '🫃', 'Nervous System': '⚡',
    'Muscles': '💪', 'Skin': '🫀', 'Intestines': '🌀',
};

// ─── Inner model — MeshPhysicalMaterial + per-vertex heatmap color ────────────
interface HumanModelProps {
    effects: HeatmapEffect[];
    isGlassMode: boolean;
    onOrganHover: (organ: string | null) => void;
    onOrganClick: (organ: string) => void;
    isExploded?: boolean;
}

const HumanModel: React.FC<HumanModelProps> = ({ effects, isGlassMode, onOrganHover, onOrganClick, isExploded }) => {
    const obj = useLoader(OBJLoader, '/Human.obj');
    const groupRef = useRef<THREE.Group>(null);
    const matRef = useRef<THREE.Material | null>(null);
    const { camera, gl, raycaster } = useThree();

    // Build organ → intensity lookup
    const organMap = useMemo(() => {
        const map: Record<string, number> = {};
        for (const e of effects) {
            const key = Object.keys(ORGAN_ZONES).find(
                k => k.toLowerCase() === (e.structure_name || '').toLowerCase()
            );
            if (key) map[key] = Math.max(0, Math.min(1, e.intensity));
        }
        return map;
    }, [effects]);

    // ── Attach Material ────────────────
    const mat = useMemo(() => {
        if (isGlassMode) {
            // X-Ray Fresnel Shader
            return new THREE.ShaderMaterial({
                uniforms: {
                    p: { value: 3.0 }, // Power (sharpness of rim)
                    glowColor: { value: new THREE.Color(0.2, 0.4, 0.8) }, // Base blue glass
                    viewVector: { value: camera.position }
                },
                vertexShader: `
                    uniform vec3 viewVector;
                    varying float intensity;
                    varying vec3 vColor;
                    void main() {
                        vColor = color;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        vec3 actual_normal = vec3(modelMatrix * vec4(normal, 0.0));
                        intensity = pow(1.0 - abs(dot(normalize(viewVector), normalize(actual_normal))), 3.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 glowColor;
                    varying float intensity;
                    varying vec3 vColor;
                    void main() {
                        // Mix the heatmap vertex color and the glass rim glow
                        vec3 finalGlow = mix(glowColor, vColor, 0.5);
                        gl_FragColor = vec4(finalGlow * intensity * 1.5 + (vColor * 0.5), intensity * 0.8 + 0.1);
                    }
                `,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false,
                vertexColors: true,
            });
        }

        // Solid material matches the original MedicalModel3D aesthetic
        return new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(BASE_COLOR),
            metalness: 0.1,
            roughness: 0.7,
            clearcoat: 0.3,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            vertexColors: true
        });
    }, [isGlassMode, camera.position]);

    useEffect(() => {
        matRef.current = mat;
    }, [mat]);

    useMemo(() => {
        obj.traverse(child => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.material = mat;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const geo = mesh.geometry;
            const count = geo.attributes.position.count;
            if (!geo.attributes.color) {
                const colors = new Float32Array(count * 3);
                for (let i = 0; i < count; i++) {
                    colors[i * 3] = BASE_COLOR.r;
                    colors[i * 3 + 1] = BASE_COLOR.g;
                    colors[i * 3 + 2] = BASE_COLOR.b;
                }
                geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            }
        });
    }, [obj, mat]);

    // ── Fit model — centred at origin ────────────────────────────────────────
    useEffect(() => {
        // Reset properties in case this runs multiple times
        obj.position.set(0, 0, 0);
        obj.scale.setScalar(1);
        obj.updateMatrixWorld();

        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Scale model to a reasonable size 
        const maxDim = Math.max(size.x, size.y, size.z);
        const s = 4.0 / (maxDim || 1);
        obj.scale.setScalar(s);

        // Center model EXACTLY at (0,0,0) factoring in the scale
        obj.position.set(-center.x * s, -center.y * s, -center.z * s);
        obj.updateMatrixWorld();

        // Dynamically adjust camera to fully capture the model frame
        const perspectiveCamera = camera as THREE.PerspectiveCamera;
        const fov = perspectiveCamera.fov * (Math.PI / 180);

        // Calculate distance needed to fit height or width
        const distance = Math.max(size.x * s, size.y * s) / (2 * Math.tan(fov / 2));

        // Place camera straight in front with a 15% margin for "full body view"
        camera.position.set(0, 0, distance * 1.15);
        camera.lookAt(0, 0, 0); // OrbitControls targets 0,0,0 by default perfectly matching this
        camera.updateProjectionMatrix();

    }, [obj, camera]);

    // ── Update vertex colors when effects change ──────────────────────────────
    useEffect(() => {
        const hasEffects = Object.keys(organMap).length > 0;
        let maxIntensity = 0;

        obj.traverse(child => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;

            const geo = mesh.geometry;
            const posAttr = geo.attributes.position as THREE.BufferAttribute;
            const colAttr = geo.attributes.color as THREE.BufferAttribute;
            if (!colAttr) return;

            const count = posAttr.count;
            const cols = colAttr.array as Float32Array;

            // Get local bounding box for normalization
            const bbox = new THREE.Box3().setFromBufferAttribute(posAttr);
            const bSize = bbox.getSize(new THREE.Vector3());
            const bMin = bbox.min;

            for (let i = 0; i < count; i++) {
                const x = posAttr.getX(i);
                const y = posAttr.getY(i);
                const fy = norm(y, bMin.y, bMin.y + bSize.y);
                const fx = bSize.x === 0 ? 0 : (x - bMin.x) / bSize.x - 0.5;

                let maxHeat = 0;
                if (hasEffects) {
                    for (const [organName, zone] of Object.entries(ORGAN_ZONES)) {
                        const intensity = organMap[organName];
                        if (intensity === undefined) continue;
                        const inY = fy >= zone.yMin && fy <= zone.yMax;
                        const inX = zone.xMin === undefined ? true
                            : (fx * 2 >= zone.xMin && fx * 2 <= zone.xMax);
                        if (inY && inX && intensity > maxHeat) {
                            maxHeat = intensity;
                        }
                    }
                }

                let col: THREE.Color;
                if (maxHeat > 0.005) {
                    col = heatColor(maxHeat);
                    if (maxHeat > maxIntensity) maxIntensity = maxHeat;
                } else {
                    col = BASE_COLOR;
                }

                cols[i * 3] = col.r;
                cols[i * 3 + 1] = col.g;
                cols[i * 3 + 2] = col.b;
            }
            colAttr.needsUpdate = true;
        });

        if (matRef.current) {
            const m = matRef.current as any;
            if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
                const p = m as THREE.MeshStandardMaterial;
                if (maxIntensity > 0) {
                    p.emissive.copy(heatColor(maxIntensity));
                    p.emissiveIntensity = 0.5 + (maxIntensity * 1.5); // Boosted for bloom
                } else {
                    p.emissive.copy(BASE_COLOR);
                    p.emissiveIntensity = 0.15;
                }
            } else if (m.isShaderMaterial) {
                // For shader material, pulse the base glow intensity if high risk
                (m as THREE.ShaderMaterial).uniforms.p.value = maxIntensity > 0 ? 2.0 : 3.0; // Thicker rim if intense
            }
        }
    }, [organMap, obj]);

    // ── Animate — Slow auto-spin and pulse the emissive glow ────────────────
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += 0.002; // Very slow idle rotation
        }

        const m = matRef.current as any;
        if (!m) return;

        if (isGlassMode && m.isShaderMaterial) {
            (m as THREE.ShaderMaterial).uniforms.viewVector.value = camera.position;
        } else if (!isGlassMode && (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) {
            const physMat = m as THREE.MeshStandardMaterial;
            if (physMat.emissiveIntensity > 0.15) { // Assuming base is 0.15
                const pulse = 0.8 + 0.2 * Math.sin(state.clock.elapsedTime * 4);
                const maxI = Math.max(0, ...Object.values(organMap));
                physMat.emissiveIntensity = 0.5 + (maxI * 1.5 * pulse);
            }
        }
    });

    // ── Pointer detection ─────────────────────────────────────────────────────
    const getOrgan = useCallback((e: PointerEvent): string | null => {
        const rect = gl.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(mouse, camera);
        const hits: THREE.Intersection[] = [];
        obj.traverse(c => { if ((c as THREE.Mesh).isMesh) hits.push(...raycaster.intersectObject(c, false)); });
        if (!hits.length) return null;
        hits.sort((a, b) => a.distance - b.distance);
        const pt = hits[0].point;
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const fy = norm(pt.y, box.min.y, box.min.y + size.y);
        const fx = norm(pt.x, box.min.x, box.min.x + size.x) - 0.5;

        let best: string | null = null;
        let bestScore = -1;
        for (const [organName, zone] of Object.entries(ORGAN_ZONES)) {
            if (!organMap[organName]) continue;
            const inY = fy >= zone.yMin && fy <= zone.yMax;
            const inX = zone.xMin === undefined ? true
                : (fx * 2 >= zone.xMin && fx * 2 <= zone.xMax);
            if (inY && inX && organMap[organName] > bestScore) {
                bestScore = organMap[organName];
                best = organName;
            }
        }
        return best;
    }, [obj, camera, raycaster, gl, organMap]);

    useEffect(() => {
        const el = gl.domElement;
        let last: string | null = null;
        const onMove = (e: PointerEvent) => {
            const o = getOrgan(e);
            if (o !== last) { last = o; onOrganHover(o); }
        };
        const onClick = (e: PointerEvent) => {
            const o = getOrgan(e);
            if (o) onOrganClick(o);
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('click', onClick as EventListener);
        return () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('click', onClick as EventListener);
        };
    }, [gl, getOrgan, onOrganHover, onOrganClick]);

    return <group ref={groupRef}><primitive object={obj} /></group>;
};

const SkeletonModel: React.FC<HumanModelProps> = ({ effects, isGlassMode, onOrganHover, onOrganClick }) => {
    const obj = useLoader(OBJLoader, '/skeleton.obj');
    const groupRef = useRef<THREE.Group>(null);
    const matRef = useRef<THREE.MeshStandardMaterial | null>(null); // Changed from MeshPhysicalMaterial
    const { camera, gl, raycaster } = useThree();

    // Build organ → intensity lookup
    const organMap = useMemo(() => {
        const map: Record<string, number> = {};
        for (const e of effects) {
            const key = Object.keys(SKELETON_ZONES).find(
                k => k.toLowerCase() === (e.structure_name || '').toLowerCase()
            );
            if (key) map[key] = Math.max(0, Math.min(1, e.intensity));
        }
        return map;
    }, [effects]);

    // ── Attach Skeleton Material ──────────────────────────
    const mat = useMemo(() => {
        return new THREE.MeshStandardMaterial({
            color: new THREE.Color('#e0e0e0'), // Standard bright bone hue
            roughness: 0.8,
            metalness: 0.1,
            wireframe: false,
            transparent: true,
            opacity: isGlassMode ? 0.3 : 1.0,
            side: THREE.DoubleSide,
            vertexColors: true,
        });
    }, [isGlassMode]);

    useEffect(() => {
        matRef.current = mat;
    }, [mat]);

    useMemo(() => {
        obj.traverse(child => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.material = mat;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const geo = mesh.geometry;
            const count = geo.attributes.position.count;
            if (!geo.attributes.color) {
                const colors = new Float32Array(count * 3);
                for (let i = 0; i < count; i++) {
                    colors[i * 3] = BASE_COLOR.r;
                    colors[i * 3 + 1] = BASE_COLOR.g;
                    colors[i * 3 + 2] = BASE_COLOR.b;
                }
                geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            }
        });
    }, [obj, mat]);

    // ── Fit model — centred at origin ────────────────────────────────────────
    useEffect(() => {
        obj.position.set(0, 0, 0);
        obj.scale.setScalar(1);
        obj.updateMatrixWorld();

        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const s = 4.0 / (maxDim || 1);
        obj.scale.setScalar(s);

        obj.position.set(-center.x * s, -center.y * s, -center.z * s);
        obj.updateMatrixWorld();
    }, [obj]); // Note: camera omitted here so it doesn't fight HumanModel for camera positioning
    // ── Update vertex colors when effects change ──────────────────────────────
    useEffect(() => {
        const hasEffects = Object.keys(organMap).length > 0;
        let maxIntensity = 0;

        obj.traverse(child => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;

            const geo = mesh.geometry;
            const posAttr = geo.attributes.position as THREE.BufferAttribute;
            const colAttr = geo.attributes.color as THREE.BufferAttribute;
            if (!colAttr) return;

            const count = posAttr.count;
            const cols = colAttr.array as Float32Array;

            const bbox = new THREE.Box3().setFromBufferAttribute(posAttr);
            const bSize = bbox.getSize(new THREE.Vector3());
            const bMin = bbox.min;

            for (let i = 0; i < count; i++) {
                const x = posAttr.getX(i);
                const y = posAttr.getY(i);
                const fy = norm(y, bMin.y, bMin.y + bSize.y);
                const fx = bSize.x === 0 ? 0 : (x - bMin.x) / bSize.x - 0.5;

                let maxHeat = 0;
                if (hasEffects) {
                    for (const [organName, zone] of Object.entries(SKELETON_ZONES)) {
                        const intensity = organMap[organName];
                        if (intensity === undefined) continue;
                        const inY = fy >= zone.yMin && fy <= zone.yMax;
                        const inX = zone.xMin === undefined ? true
                            : (fx * 2 >= zone.xMin && fx * 2 <= zone.xMax);
                        if (inY && inX && intensity > maxHeat) {
                            maxHeat = intensity;
                        }
                    }
                }

                let col: THREE.Color;
                if (maxHeat > 0.005) {
                    col = heatColor(maxHeat);
                    if (maxHeat > maxIntensity) maxIntensity = maxHeat;
                } else {
                    col = BASE_COLOR;
                }

                cols[i * 3] = col.r;
                cols[i * 3 + 1] = col.g;
                cols[i * 3 + 2] = col.b;
            }
            colAttr.needsUpdate = true;
        });

        if (matRef.current) {
            if (maxIntensity > 0) {
                matRef.current.emissive.copy(heatColor(maxIntensity));
                matRef.current.emissiveIntensity = 0.5 + (maxIntensity * 1.5);
            } else {
                matRef.current.emissive.set(BASE_COLOR);
                matRef.current.emissiveIntensity = 0.2;
            }
        }
    }, [organMap, obj]);

    useFrame((state) => {
        if (groupRef.current) groupRef.current.rotation.y += 0.002;
        if (matRef.current && matRef.current.emissiveIntensity > 0.2) {
            const pulse = 0.8 + 0.2 * Math.sin(state.clock.elapsedTime * 4);
            const maxI = Math.max(0, ...Object.values(organMap));
            matRef.current.emissiveIntensity = 0.5 + (maxI * 1.5 * pulse);
        }
    });

    const getOrgan = useCallback((e: PointerEvent): string | null => {
        const rect = gl.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(mouse, camera);
        const hits: THREE.Intersection[] = [];
        obj.traverse(c => { if ((c as THREE.Mesh).isMesh) hits.push(...raycaster.intersectObject(c, false)); });
        if (!hits.length) return null;
        hits.sort((a, b) => a.distance - b.distance);
        const pt = hits[0].point;
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const fy = norm(pt.y, box.min.y, box.min.y + size.y);
        const fx = norm(pt.x, box.min.x, box.min.x + size.x) - 0.5;

        let best: string | null = null;
        let bestScore = -1;
        for (const [organName, zone] of Object.entries(SKELETON_ZONES)) {
            if (!organMap[organName]) continue;
            const inY = fy >= zone.yMin && fy <= zone.yMax;
            const inX = zone.xMin === undefined ? true
                : (fx * 2 >= zone.xMin && fx * 2 <= zone.xMax);
            if (inY && inX && organMap[organName] > bestScore) {
                bestScore = organMap[organName];
                best = organName;
            }
        }
        return best;
    }, [obj, camera, raycaster, gl, organMap]);

    useEffect(() => {
        const el = gl.domElement;
        let last: string | null = null;
        const onMove = (e: PointerEvent) => {
            const o = getOrgan(e);
            if (o !== last) { last = o; onOrganHover(o); }
        };
        const onClick = (e: PointerEvent) => {
            const o = getOrgan(e);
            if (o) onOrganClick(o);
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('click', onClick as EventListener);
        return () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('click', onClick as EventListener);
        };
    }, [gl, getOrgan, onOrganHover, onOrganClick]);

    return <group ref={groupRef}><primitive object={obj} /></group>;
};

export interface DrugHeatmap3DProps {
    effects: HeatmapEffect[];
    selectedOrgan: string | null;
    isGlassMode: boolean;
    showSkeleton: boolean;
    showBody: boolean;
    onOrganSelect: (organ: string) => void;
    isAnalyzing?: boolean;
    handRotationDelta?: { x: number; y: number };
    handDragDelta?: { x: number; y: number };
    handZoomDelta?: number;
    resetCameraFlag?: number;
}

const RotatingHUD = () => {
    const ring1Ref = useRef<THREE.Mesh>(null);
    const ring2Ref = useRef<THREE.Mesh>(null);
    const ring3Ref = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const time = state.clock.elapsedTime;
        if (ring1Ref.current) {
            ring1Ref.current.rotation.z = time * 0.2;
            ring1Ref.current.rotation.x = Math.PI / 2;
        }
        if (ring2Ref.current) {
            ring2Ref.current.rotation.z = -time * 0.15;
            ring2Ref.current.rotation.x = Math.PI / 2 + 0.1;
        }
        if (ring3Ref.current) {
            ring3Ref.current.rotation.z = time * 0.1;
            ring3Ref.current.rotation.x = Math.PI / 2 - 0.1;
        }
    });

    return (
        <group position={[0, -0.2, 0]}>
            <mesh ref={ring1Ref}>
                <ringGeometry args={[1.5, 1.52, 64]} />
                <meshBasicMaterial color="#00ffff" transparent opacity={0.3} side={THREE.DoubleSide} />
            </mesh>
            <mesh ref={ring2Ref}>
                <ringGeometry args={[1.8, 1.83, 64]} />
                <meshBasicMaterial color="#3b82f6" transparent opacity={0.2} side={THREE.DoubleSide} />
            </mesh>
            <mesh ref={ring3Ref}>
                <ringGeometry args={[2.2, 2.22, 128, 1, 0, Math.PI * 1.5]} />
                <meshBasicMaterial color="#00ffff" transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};

const PharmacokineticsFlow = ({ active }: { active: boolean }) => {
    const particlesRef = useRef<THREE.Points>(null);
    const particleCount = 400;

    // Path points from mouth -> throat -> stomach -> liver
    const curve = useMemo(() => {
        return new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 1.6, 0.4),    // Mouth
            new THREE.Vector3(0, 1.2, 0.2),    // Throat
            new THREE.Vector3(0, 0.5, 0.3),    // Stomach
            new THREE.Vector3(0.3, 0.2, 0.2),  // Liver
            new THREE.Vector3(-0.2, -0.1, 0.2),// Intestines
            new THREE.Vector3(0, -0.8, 0.1)    // Dispersion
        ]);
    }, []);

    const positions = useMemo(() => {
        const arr = new Float32Array(particleCount * 3);
        // Initialization (all start at mouth)
        for (let i = 0; i < particleCount; i++) {
            arr[i * 3] = 0; arr[i * 3 + 1] = 1.6; arr[i * 3 + 2] = 0.4;
        }
        return arr;
    }, [particleCount]);

    // Randomize start delays so particles flow continuously
    const progressRef = useRef(new Float32Array(particleCount).map(() => -Math.random() * 3));

    useFrame((state, delta) => {
        if (!active || !particlesRef.current) return;
        const pts = particlesRef.current.geometry.attributes.position.array as Float32Array;
        const speeds = progressRef.current;

        for (let i = 0; i < particleCount; i++) {
            speeds[i] += delta * 0.15; // Slow travel down the body
            if (speeds[i] > 1) { speeds[i] = -Math.random(); } // Reset and delay

            if (speeds[i] >= 0) {
                const pt = curve.getPointAt(speeds[i]);
                // Increasing scatter as it gets deeper into the body
                const scatter = 0.08 * (1 - Math.pow(1 - speeds[i], 3));
                pts[i * 3] = pt.x + (Math.random() - 0.5) * scatter;
                pts[i * 3 + 1] = pt.y + (Math.random() - 0.5) * scatter;
                pts[i * 3 + 2] = pt.z + (Math.random() - 0.5) * scatter;
            } else {
                pts[i * 3] = 0; pts[i * 3 + 1] = 1.6; pts[i * 3 + 2] = 0.4; // Hide at mouth
            }
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
    });

    if (!active) return null;

    return (
        <points ref={particlesRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={particleCount}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.02}
                color="#00ffff"
                transparent
                opacity={0.9}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                sizeAttenuation={true}
            />
        </points>
    );
};

const GestureController = ({ orbitRef, rotationDelta, zoomDelta, dragDelta, resetFlag }: { orbitRef: React.RefObject<any>, rotationDelta?: { x: number, y: number }, zoomDelta?: number, dragDelta?: { x: number, y: number }, resetFlag?: number }) => {
    const { camera } = useThree();

    // 1. Zoom Logic (Pinch or Swipe Depth)
    useEffect(() => {
        if (!orbitRef.current || !zoomDelta || zoomDelta === 0) return;
        const controls = orbitRef.current;
        const target = controls.target;
        const dist = camera.position.distanceTo(target);
        const newDist = Math.max(2, Math.min(12, dist + zoomDelta));
        const dir = new THREE.Vector3().subVectors(camera.position, target).normalize();
        camera.position.copy(target).add(dir.multiplyScalar(newDist));
        controls.update();
    }, [zoomDelta, camera, orbitRef]);

    // 2. Drag Logic
    useEffect(() => {
        if (!orbitRef.current || !dragDelta) return;
        if (dragDelta.x !== 0 || dragDelta.y !== 0) {
            const controls = orbitRef.current;
            controls.enablePan = true;
            controls.target.x -= dragDelta.x * 0.05;
            controls.target.y += dragDelta.y * 0.05;
            controls.update();
        }
    }, [dragDelta, orbitRef]);

    // 3. Rotation Logic (Point Finger)
    useEffect(() => {
        if (!orbitRef.current || !rotationDelta) return;
        if (rotationDelta.x !== 0 || rotationDelta.y !== 0) {
            const controls = orbitRef.current;

            controls.setAzimuthalAngle(controls.getAzimuthalAngle() - (rotationDelta.x * 3.0));
            controls.setPolarAngle(controls.getPolarAngle() - (rotationDelta.y * 3.0));

            controls.update();
        }
    }, [rotationDelta, orbitRef]);

    // 4. Reset Camera Logic (Five Fingers)
    useEffect(() => {
        if (!orbitRef.current || !resetFlag) return;
        const controls = orbitRef.current;
        controls.reset();
        camera.position.set(0, 0, 5);
        controls.target.set(0, 0, 0);
        controls.update();
    }, [resetFlag, camera, orbitRef]);

    return null;
};

const DrugHeatmap3D: React.FC<DrugHeatmap3DProps> = ({
    effects, selectedOrgan, isGlassMode, showSkeleton, showBody, onOrganSelect, isAnalyzing, handRotationDelta, handDragDelta, handZoomDelta, resetCameraFlag
}) => {
    const orbitRef = useRef<any>(null);
    const [hoveredOrgan, setHoveredOrgan] = useState<string | null>(null);
    const hoveredEffect = effects.find(e => (e.structure_name || '').toLowerCase() === hoveredOrgan?.toLowerCase());

    // Calculate max intensity to drive sparkle reactivity
    const maxIntensity = useMemo(() => {
        return effects.length > 0 ? Math.max(...effects.map(e => e.intensity)) : 0;
    }, [effects]);

    const organEffects = useMemo(() => effects.filter(e => e.layer !== 'SKELETON_VIEW'), [effects]);
    const skeletonEffects = useMemo(() => effects.filter(e => e.layer === 'SKELETON_VIEW'), [effects]);

    return (
        <div className="relative w-full h-full select-none">
            {/* ── Three.js Canvas ── */}
            <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 5], fov: 45 }}>
                <fog attach="fog" args={['#000000', 10, 25]} />

                {/* Lighting — exact match to MedicalModel3D */}
                <ambientLight intensity={0.7} color="#ffffff" />
                <spotLight position={[10, 10, 10]} angle={0.2} penumbra={1}
                    intensity={1.2} castShadow shadow-mapSize={[780, 780]} color="#ffffff" />
                <pointLight position={[-10, 0, -10]} intensity={1.5} color="#3b82f6" />
                <spotLight position={[0, 5, -5]} intensity={2} color="#06b6d4" />

                <React.Suspense fallback={null}>
                    {showBody && (
                        <HumanModel
                            effects={organEffects}
                            isGlassMode={isGlassMode}
                            onOrganHover={setHoveredOrgan}
                            onOrganClick={onOrganSelect}
                        />
                    )}
                    {showSkeleton && (
                        <SkeletonModel
                            effects={skeletonEffects}
                            isGlassMode={isGlassMode}
                            onOrganHover={setHoveredOrgan}
                            onOrganClick={onOrganSelect}
                        />
                    )}
                </React.Suspense>

                {/* Simulated Pharmacokinetics Drug Flow Particles */}
                <PharmacokineticsFlow active={organEffects.length > 0 || skeletonEffects.length > 0} />

                {/* Reactive sparkles: more intense drugs mean faster, denser, and sharper colored sparkles */}
                <Sparkles
                    count={maxIntensity > 0 ? 30 + Math.floor(maxIntensity * 70) : 30}
                    scale={8}
                    size={maxIntensity > 0 ? 2 + maxIntensity * 3 : 2}
                    speed={maxIntensity > 0 ? 0.5 + maxIntensity * 1.5 : 0.5}
                    opacity={0.4 + (maxIntensity * 0.4)}
                    color={maxIntensity > 0.7 ? "#fca5a5" : maxIntensity > 0.4 ? "#fde047" : "#bae6fd"}
                />
                <Environment preset="city" blur={1} />
                <ContactShadows resolution={512} scale={20} blur={2} opacity={0.4} far={10} color="#082f49" />

                <OrbitControls
                    ref={orbitRef}
                    enablePan={false}
                    minDistance={2}
                    maxDistance={12}
                    autoRotate={true}
                    autoRotateSpeed={0.8}
                    enableDamping
                    dampingFactor={0.08}
                />
                <GestureController orbitRef={orbitRef} rotationDelta={handRotationDelta} dragDelta={handDragDelta} zoomDelta={handZoomDelta} resetFlag={resetCameraFlag} />
            </Canvas>

            {/* ── Hover tooltip ─────────────────────────────────────────── */}
            {hoveredOrgan && hoveredEffect && (() => {
                const { text, hex } = heatLabelColor(hoveredEffect.intensity);
                return (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none
                        bg-black/85 backdrop-blur-xl border border-white/20 rounded-2xl px-5 py-3.5
                        shadow-2xl min-w-[210px] text-center">
                        <p className="text-base font-black text-white flex items-center justify-center gap-2">
                            <span>{ORGAN_ICONS[hoveredOrgan] ?? '🫀'}</span> {hoveredOrgan}
                        </p>
                        <p className="text-xs text-blue-200/70 mt-0.5">{hoveredEffect.effect_type} {hoveredEffect.mechanism && ` - ${hoveredEffect.mechanism}`}</p>
                        <div className="mt-2.5 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${hoveredEffect.intensity * 100}%`,
                                    background: `linear-gradient(to right, #facc15, ${hex})`
                                }} />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-white/40">Intensity</span>
                            <span className="text-xs font-bold" style={{ color: hex }}>
                                {text} · {(hoveredEffect.intensity * 100).toFixed(0)}%
                            </span>
                        </div>
                        {/* No longer using per-effect onset since it is now in pharmacokinetics, but we can display the risk level */}
                        {hoveredEffect.risk_level && (
                            <p className="text-[10px] text-white/30 mt-1">
                                Risk: {hoveredEffect.risk_level.toUpperCase()}
                            </p>
                        )}
                    </div>
                );
            })()}

            {/* ── Bottom controls ───────────────────────────────────────── */}
            {effects.length > 0 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                    <button
                        onClick={() => onOrganSelect('')}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold border border-white/15
                            bg-black/40 text-white/50 hover:text-white hover:border-white/35 transition-all backdrop-blur-sm">
                        ↺ Reset View
                    </button>
                </div>
            )}

            {/* ── Scan animation while analyzing ───────────────────────── */}
            {isAnalyzing && (
                <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px]
                        bg-gradient-to-r from-transparent via-rose-400 to-transparent
                        shadow-[0_0_24px_#f43f5e] animate-scan" />
                    <div className="absolute inset-0 bg-rose-500/5 animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/75 backdrop-blur-md rounded-2xl px-6 py-4
                            border border-rose-500/30 flex items-center gap-3">
                            <div className="w-4 h-4 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" />
                            <span className="text-rose-300 font-bold text-sm">Analyzing Pharmacology...</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Idle hint ─────────────────────────────────────────────── */}
            {effects.length === 0 && !isAnalyzing && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10">
                    <p className="text-white/15 text-[10px] font-mono uppercase tracking-[0.2em] animate-pulse">
                        Select a drug · run analysis
                    </p>
                </div>
            )}

            <style>{`
                @keyframes scan { 0%{top:0} 100%{top:100%} }
                .animate-scan { animation: scan 2.2s linear infinite; }
            `}</style>
        </div>
    );
};

export default DrugHeatmap3D;
