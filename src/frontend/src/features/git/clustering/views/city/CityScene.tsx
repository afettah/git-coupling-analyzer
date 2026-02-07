/**
 * Advanced 3D City Scene Component
 * 
 * Renders the Three.js scene with:
 * - Advanced multi-light setup with colored lighting
 * - Fog / atmosphere effects
 * - Animated particle system (floating dust motes)
 * - Street grid overlay
 * - Coupling beam connections
 * - Heatmap overlay mode
 * - Environment reflections
 * - Multiple camera presets
 */

import { memo, useMemo, useRef, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import type { RootState } from '@react-three/fiber';
import type { BuildingData, DistrictData } from '../../types/index';
import type { CityColorSettings } from '../../hooks/useCitySettings';
import { Buildings, Districts, CouplingBeams, StreetGrid, HeatmapOverlay } from './CityElements';
import { calculateCameraPosition } from './cameraUtils';

// ============================================================
// View Mode Type
// ============================================================

export type CityViewMode = 'standard' | 'glass' | 'neon' | 'minimal';

// ============================================================
// Scene Lighting (Enhanced)
// ============================================================

interface SceneLightingProps {
    viewMode?: CityViewMode;
}

const SceneLighting = memo(function SceneLighting({ viewMode = 'standard' }: SceneLightingProps) {
    const lightRef = useRef<THREE.DirectionalLight>(null);

    // Animated light for neon mode
    useFrame((state: RootState) => {
        if (viewMode === 'neon' && lightRef.current) {
            const t = state.clock.elapsedTime;
            lightRef.current.color.setHSL((t * 0.05) % 1, 0.6, 0.6);
        }
    });

    const ambientIntensity = viewMode === 'neon' ? 0.2 : viewMode === 'glass' ? 0.5 : 0.4;
    const mainIntensity = viewMode === 'neon' ? 0.6 : 0.8;

    return (
        <>
            <ambientLight intensity={ambientIntensity} />
            <directionalLight
                ref={lightRef}
                position={[50, 50, 25]}
                intensity={mainIntensity}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-far={200}
                shadow-camera-left={-80}
                shadow-camera-right={80}
                shadow-camera-top={80}
                shadow-camera-bottom={-80}
            />
            <directionalLight
                position={[-30, 30, -20]}
                intensity={0.3}
                color={viewMode === 'neon' ? '#a855f7' : '#ffffff'}
            />
            {/* Fill light from below for glass mode */}
            {viewMode === 'glass' && (
                <pointLight position={[0, -5, 0]} intensity={0.2} color="#60a5fa" />
            )}
            {/* Colored accent lights for neon mode */}
            {viewMode === 'neon' && (
                <>
                    <pointLight position={[20, 10, 20]} intensity={0.5} color="#06b6d4" distance={40} />
                    <pointLight position={[-20, 10, -20]} intensity={0.5} color="#e879f9" distance={40} />
                    <pointLight position={[20, 10, -20]} intensity={0.3} color="#22c55e" distance={30} />
                </>
            )}
        </>
    );
});

// ============================================================
// Animated Particles (Floating Dust Motes)
// ============================================================

interface ParticlesProps {
    count?: number;
    cityWidth: number;
    cityHeight: number;
    color?: string;
}

const Particles = memo(function Particles({
    count = 200,
    cityWidth,
    cityHeight,
    color = '#94a3b8'
}: ParticlesProps) {
    const meshRef = useRef<THREE.Points>(null);

    const particles = useMemo(() => {
        const positions = new Float32Array(count * 3);
        const speeds = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = Math.random() * cityWidth;
            positions[i * 3 + 1] = Math.random() * 8 + 0.5;
            positions[i * 3 + 2] = Math.random() * cityHeight;
            speeds[i] = 0.1 + Math.random() * 0.3;
        }
        return { positions, speeds };
    }, [count, cityWidth, cityHeight]);

    useFrame((state: RootState) => {
        if (!meshRef.current) return;
        const positions = meshRef.current.geometry.attributes.position.array as Float32Array;
        const t = state.clock.elapsedTime;

        for (let i = 0; i < count; i++) {
            positions[i * 3 + 1] += Math.sin(t * particles.speeds[i] + i) * 0.003;
            positions[i * 3] += Math.cos(t * 0.1 + i) * 0.002;

            // Wrap around
            if (positions[i * 3 + 1] > 10) positions[i * 3 + 1] = 0.5;
            if (positions[i * 3 + 1] < 0.3) positions[i * 3 + 1] = 8;
        }
        meshRef.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <points ref={meshRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[particles.positions, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                color={color}
                size={0.04}
                transparent
                opacity={0.4}
                sizeAttenuation
            />
        </points>
    );
});

// ============================================================
// Ground Plane (Enhanced)
// ============================================================

interface GroundProps {
    width: number;
    height: number;
    color?: string;
    viewMode?: CityViewMode;
}

const Ground = memo(function Ground({
    width,
    height,
    color = '#1a1a2e',
    viewMode = 'standard'
}: GroundProps) {
    const extraPadding = Math.max(width, height) * 0.15;

    return (
        <group>
            {/* Main ground */}
            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[width / 2, -0.05, height / 2]}
                receiveShadow
            >
                <planeGeometry args={[width + extraPadding * 2, height + extraPadding * 2]} />
                <meshStandardMaterial
                    color={color}
                    roughness={0.9}
                    metalness={0.1}
                />
            </mesh>

            {/* Subtle gradient edge fade */}
            {viewMode !== 'minimal' && (
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[width / 2, -0.06, height / 2]}
                    receiveShadow
                >
                    <planeGeometry args={[width + extraPadding * 4, height + extraPadding * 4]} />
                    <meshStandardMaterial
                        color={color}
                        transparent
                        opacity={0.5}
                        roughness={1}
                    />
                </mesh>
            )}
        </group>
    );
});

// ============================================================
// Atmosphere / Fog Controller
// ============================================================

interface AtmosphereProps {
    viewMode?: CityViewMode;
    citySize: number;
}

const Atmosphere = memo(function Atmosphere({ viewMode = 'standard', citySize }: AtmosphereProps) {
    const { scene } = useThree();

    useEffect(() => {
        if (viewMode === 'neon') {
            scene.fog = new THREE.FogExp2('#0a0a1a', 0.008);
        } else if (viewMode === 'glass') {
            scene.fog = new THREE.Fog('#0f172a', citySize * 0.5, citySize * 2);
        } else if (viewMode === 'minimal') {
            scene.fog = null;
        } else {
            scene.fog = new THREE.Fog('#1a1a2e', citySize * 0.8, citySize * 2.5);
        }
        return () => { scene.fog = null; };
    }, [viewMode, citySize, scene]);

    return null;
});

// ============================================================
// Camera Preset Animator
// ============================================================

export type CameraPreset = 'overview' | 'top-down' | 'street-level' | 'isometric' | 'cinematic';

interface CameraAnimatorProps {
    preset: CameraPreset;
    cityWidth: number;
    cityHeight: number;
    enabled: boolean;
}

const CameraAnimator = memo(function CameraAnimator({
    preset, cityWidth, cityHeight, enabled
}: CameraAnimatorProps) {
    const { camera } = useThree();
    const targetPos = useRef(new THREE.Vector3());
    const animating = useRef(false);
    const frameCount = useRef(0);

    useEffect(() => {
        if (!enabled) return;
        const cx = cityWidth / 2;
        const cz = cityHeight / 2;
        const maxDim = Math.max(cityWidth, cityHeight);

        switch (preset) {
            case 'overview':
                targetPos.current.set(cx, maxDim * 0.8, cz + maxDim * 0.4);
                break;
            case 'top-down':
                targetPos.current.set(cx, maxDim * 1.2, cz + 0.01);
                break;
            case 'street-level':
                targetPos.current.set(cx - maxDim * 0.3, 2, cz);
                break;
            case 'isometric':
                targetPos.current.set(cx + maxDim * 0.5, maxDim * 0.5, cz + maxDim * 0.5);
                break;
            case 'cinematic':
                targetPos.current.set(cx - maxDim * 0.2, maxDim * 0.3, cz + maxDim * 0.6);
                break;
        }
        animating.current = true;
        frameCount.current = 0;
    }, [preset, cityWidth, cityHeight, enabled]);

    useFrame((_state: RootState, delta: number) => {
        if (!animating.current || !enabled) return;
        frameCount.current++;

        camera.position.lerp(targetPos.current, delta * 2);

        if (camera.position.distanceTo(targetPos.current) < 0.1 || frameCount.current > 180) {
            animating.current = false;
        }
    });

    return null;
});

// ============================================================
// City Content (Composites all 3D elements)
// ============================================================

interface CityContentProps {
    buildings: BuildingData[];
    districts: DistrictData[];
    cityWidth: number;
    cityHeight: number;
    selectedPath?: string | null;
    onSelectBuilding?: (building: BuildingData) => void;
    showLabels?: boolean;
    colorSettings?: CityColorSettings;
    viewMode?: CityViewMode;
    showGrid?: boolean;
    showBeams?: boolean;
    showHeatmap?: boolean;
    showParticles?: boolean;
    cameraPreset?: CameraPreset;
}

const CityContent = memo(function CityContent({
    buildings,
    districts,
    cityWidth,
    cityHeight,
    selectedPath,
    onSelectBuilding,
    showLabels = true,
    colorSettings,
    viewMode = 'standard',
    showGrid = false,
    showBeams = false,
    showHeatmap = false,
    showParticles = true,
    cameraPreset = 'overview'
}: CityContentProps) {
    const groundColor = colorSettings?.groundColor || '#1a1a2e';
    const folderColors = colorSettings?.folderColors;
    const citySize = Math.max(cityWidth, cityHeight);

    return (
        <>
            <SceneLighting viewMode={viewMode} />
            <Atmosphere viewMode={viewMode} citySize={citySize} />
            <Ground width={cityWidth} height={cityHeight} color={groundColor} viewMode={viewMode} />

            {/* Street grid */}
            {showGrid && (
                <StreetGrid cityWidth={cityWidth} cityHeight={cityHeight} />
            )}

            {/* Heatmap overlay */}
            {showHeatmap && (
                <HeatmapOverlay
                    buildings={buildings}
                    cityWidth={cityWidth}
                    cityHeight={cityHeight}
                />
            )}

            {/* Districts (folders) */}
            <Districts
                districts={districts}
                showLabels={showLabels}
                customColors={folderColors}
                viewMode={viewMode}
            />

            {/* Buildings (files) */}
            <Buildings
                buildings={buildings}
                selectedPath={selectedPath}
                onSelectBuilding={onSelectBuilding}
                selectedColor={colorSettings?.selectedColor}
                hoveredColor={colorSettings?.hoveredColor}
                viewMode={viewMode}
            />

            {/* Coupling beams */}
            {showBeams && (
                <CouplingBeams buildings={buildings} />
            )}

            {/* Floating particles */}
            {showParticles && viewMode !== 'minimal' && (
                <Particles
                    cityWidth={cityWidth}
                    cityHeight={cityHeight}
                    color={viewMode === 'neon' ? '#a78bfa' : '#94a3b8'}
                    count={Math.min(300, Math.max(50, buildings.length))}
                />
            )}

            {/* Camera preset animator */}
            <CameraAnimator
                preset={cameraPreset}
                cityWidth={cityWidth}
                cityHeight={cityHeight}
                enabled={false}
            />

            {/* Environment reflections for glass mode */}
            {viewMode === 'glass' && (
                <Environment preset="city" />
            )}

            {/* Stars background for neon mode */}
            {viewMode === 'neon' && (
                <Stars
                    radius={100}
                    depth={50}
                    count={1000}
                    factor={2}
                    saturation={0.5}
                    fade
                    speed={0.5}
                />
            )}
        </>
    );
});

// ============================================================
// Loading Fallback (Enhanced)
// ============================================================

const LoadingFallback = memo(function LoadingFallback() {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state: RootState) => {
        if (meshRef.current) {
            meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
            meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
        }
    });

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <mesh ref={meshRef}>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#4a5568" wireframe />
            </mesh>
        </Float>
    );
});

// ============================================================
// Background Gradient
// ============================================================

function getBackgroundStyle(viewMode: CityViewMode): string {
    switch (viewMode) {
        case 'neon':
            return 'linear-gradient(to bottom, #0a0118 0%, #1a0a2e 50%, #0f0520 100%)';
        case 'glass':
            return 'linear-gradient(to bottom, #0c1524 0%, #0f172a 50%, #162032 100%)';
        case 'minimal':
            return 'linear-gradient(to bottom, #f8fafc 0%, #e2e8f0 100%)';
        default:
            return 'linear-gradient(to bottom, #1a1a2e 0%, #16213e 100%)';
    }
}

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
    colorSettings?: CityColorSettings;
    viewMode?: CityViewMode;
    showGrid?: boolean;
    showBeams?: boolean;
    showHeatmap?: boolean;
    showParticles?: boolean;
    cameraPreset?: CameraPreset;
}

export const CityScene = memo(function CityScene({
    buildings,
    districts,
    cityWidth,
    cityHeight,
    selectedPath,
    onSelectBuilding,
    showLabels = true,
    autoRotate = false,
    colorSettings,
    viewMode = 'standard',
    showGrid = false,
    showBeams = false,
    showHeatmap = false,
    showParticles = true,
    cameraPreset = 'overview'
}: CitySceneProps) {
    const cameraSettings = useMemo(
        () => calculateCameraPosition(cityWidth, cityHeight),
        [cityWidth, cityHeight]
    );

    const backgroundStyle = useMemo(() => getBackgroundStyle(viewMode), [viewMode]);

    return (
        <Canvas
            shadows
            camera={{
                position: cameraSettings.position,
                fov: 50,
                near: 0.1,
                far: 1000
            }}
            style={{ background: backgroundStyle }}
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
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
                    colorSettings={colorSettings}
                    viewMode={viewMode}
                    showGrid={showGrid}
                    showBeams={showBeams}
                    showHeatmap={showHeatmap}
                    showParticles={showParticles}
                    cameraPreset={cameraPreset}
                />
            </Suspense>
            <OrbitControls
                target={cameraSettings.target}
                autoRotate={autoRotate}
                autoRotateSpeed={0.5}
                minDistance={2}
                maxDistance={200}
                maxPolarAngle={Math.PI / 2.1}
                enableDamping
                dampingFactor={0.05}
                zoomSpeed={1.2}
            />
        </Canvas>
    );
});
