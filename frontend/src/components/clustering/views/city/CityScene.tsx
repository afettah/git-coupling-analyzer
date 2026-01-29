/**
 * 3D City Scene Component
 * 
 * Renders the Three.js scene with lighting, controls, and city elements.
 */

import React, { memo, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import type { BuildingData, DistrictData } from '../types';
import { Buildings, Districts } from './CityElements';
import { calculateCameraPosition } from './cameraUtils';

// ============================================================
// Scene Lighting
// ============================================================

const SceneLighting = memo(function SceneLighting() {
    return (
        <>
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[50, 50, 25]}
                intensity={0.8}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-far={100}
                shadow-camera-left={-50}
                shadow-camera-right={50}
                shadow-camera-top={50}
                shadow-camera-bottom={-50}
            />
            <directionalLight
                position={[-30, 30, -20]}
                intensity={0.3}
            />
        </>
    );
});

// ============================================================
// Ground Plane
// ============================================================

interface GroundProps {
    width: number;
    height: number;
    color?: string;
}

const Ground = memo(function Ground({
    width,
    height,
    color = '#1a1a2e'
}: GroundProps) {
    return (
        <mesh
            position={[width / 2, -0.1, height / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
        >
            <planeGeometry args={[width * 1.5, height * 1.5]} />
            <meshStandardMaterial color={color} />
        </mesh>
    );
});

// ============================================================
// City Content
// ============================================================

interface CityContentProps {
    buildings: BuildingData[];
    districts: DistrictData[];
    cityWidth: number;
    cityHeight: number;
    selectedPath?: string | null;
    onSelectBuilding?: (building: BuildingData) => void;
    showLabels?: boolean;
}

const CityContent = memo(function CityContent({
    buildings,
    districts,
    cityWidth,
    cityHeight,
    selectedPath,
    onSelectBuilding,
    showLabels = true
}: CityContentProps) {
    return (
        <>
            <SceneLighting />
            <Ground width={cityWidth} height={cityHeight} />
            <Districts districts={districts} showLabels={showLabels} />
            <Buildings
                buildings={buildings}
                selectedPath={selectedPath}
                onSelectBuilding={onSelectBuilding}
                showLabels={showLabels}
            />
            <ContactShadows
                position={[cityWidth / 2, -0.05, cityHeight / 2]}
                opacity={0.4}
                scale={Math.max(cityWidth, cityHeight) * 1.5}
                blur={1}
                far={10}
            />
            <Environment preset="city" />
        </>
    );
});

// ============================================================
// Loading Fallback
// ============================================================

const LoadingFallback = memo(function LoadingFallback() {
    return (
        <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#4a5568" wireframe />
        </mesh>
    );
});

// ============================================================
// Main CityScene Component
// ============================================================

interface CitySceneProps {
    buildings: BuildingData[];
    districts: DistrictData[];
    cityWidth: number;
    cityHeight: number;
    selectedPath?: string | null;
    onSelectBuilding?: (building: BuildingData) => void;
    showLabels?: boolean;
    autoRotate?: boolean;
}

export const CityScene = memo(function CityScene({
    buildings,
    districts,
    cityWidth,
    cityHeight,
    selectedPath,
    onSelectBuilding,
    showLabels = true,
    autoRotate = false
}: CitySceneProps) {
    const cameraSettings = useMemo(
        () => calculateCameraPosition(cityWidth, cityHeight),
        [cityWidth, cityHeight]
    );

    return (
        <Canvas
            shadows
            camera={{
                position: cameraSettings.position,
                fov: 50,
                near: 0.1,
                far: 1000
            }}
            style={{ background: 'linear-gradient(to bottom, #1a1a2e 0%, #16213e 100%)' }}
        >
            <Suspense fallback={<LoadingFallback />}>
                <CityContent
                    buildings={buildings}
                    districts={districts}
                    cityWidth={cityWidth}
                    cityHeight={cityHeight}
                    selectedPath={selectedPath}
                    onSelectBuilding={onSelectBuilding}
                    showLabels={showLabels}
                />
            </Suspense>
            <OrbitControls
                target={cameraSettings.target}
                autoRotate={autoRotate}
                autoRotateSpeed={0.5}
                minDistance={5}
                maxDistance={100}
                maxPolarAngle={Math.PI / 2.2}
                enableDamping
                dampingFactor={0.05}
            />
        </Canvas>
    );
});
