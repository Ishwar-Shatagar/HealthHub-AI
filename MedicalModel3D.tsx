import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Environment, Sparkles, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
// @ts-ignore
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

const HumanModel = (props: any) => {
    const obj = useLoader(OBJLoader, '/Human.obj');
    const meshRef = useRef<THREE.Group>(null);
    const { camera } = useThree();

    // Apply premium medical-grade material
    useMemo(() => {
        obj.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.material = new THREE.MeshPhysicalMaterial({
                    color: new THREE.Color('#e0f2fe'),
                    metalness: 0.5,
                    roughness: 0.2,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    transmission: 0.1,
                    opacity: 1.0,
                    transparent: false,
                    side: THREE.DoubleSide,
                });
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
    }, [obj]);

    // Smooth rotation
    useFrame(() => {
        if (meshRef.current) {
            meshRef.current.rotation.y += 0.10;
        }
    });

    // Fit model dynamically
    React.useLayoutEffect(() => {
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Center model
        obj.position.sub(center);

        // Lift slightly
        obj.position.y += size.y * 0.2;

        // Scale model
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 1.8 / maxDim;
        obj.scale.setScalar(scaleFactor);

        // Recalculate after scaling
        const scaledBox = new THREE.Box3().setFromObject(obj);
        const scaledSize = scaledBox.getSize(new THREE.Vector3());

        obj.position.y += scaledSize.y / 2;

        // Camera fit
        const fov = camera.fov * (Math.PI / 180);
        const distance = (scaledSize.y / 2) / Math.tan(fov / 2);

        camera.position.set(0, scaledSize.y * 0.6, distance * 1.4);
        camera.lookAt(0, scaledSize.y / 2, 0);
        camera.updateProjectionMatrix();

    }, [obj, camera]);

    return (
        <group ref={meshRef} {...props}>
            <primitive object={obj} />
        </group>
    );
};

const MedicalModel3D = () => {
    return (
        <div className="w-full h-full min-h-[400px] relative transition-all duration-500 hover:scale-[1.01] overflow-visible">
            <Canvas shadows dpr={[1, 2]} style={{ background: 'transparent' }}>
                <fog attach="fog" args={['#0f172a', 10, 25]} />

                {/* Lighting */}
                <ambientLight intensity={0.7} color="#ffffff" />

                <spotLight
                    position={[10, 10, 10]}
                    angle={0.2}
                    penumbra={1}
                    intensity={1.2}
                    castShadow
                    shadow-mapSize={[780, 780]}
                    color="#ffffff"
                />

                <pointLight position={[-10, 0, -10]} intensity={1.5} color="#3b82f6" />
                <spotLight position={[0, 5, -5]} intensity={2} color="#06b6d4" />

                <React.Suspense fallback={null}>
                    <HumanModel />
                </React.Suspense>

                <Sparkles count={30} scale={8} size={2} speed={0.5} opacity={0.4} color="#bae6fd" />
                <Environment preset="city" blur={1} />

                <ContactShadows
                    resolution={512}
                    scale={20}
                    blur={2}
                    opacity={0.4}
                    far={10}
                    color="#082f49"
                />
            </Canvas>
        </div>
    );
};

export default MedicalModel3D;