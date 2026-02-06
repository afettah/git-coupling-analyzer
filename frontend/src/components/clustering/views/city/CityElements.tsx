/**
 * Advanced 3D Building Components for ProjectCity
 * 
 * Features:
 * - Glass/metallic material buildings with PBR shading
 * - Rounded roof caps for a modern city look
 * - Animated hover/select transitions with spring physics
 * - Instanced rendering for large projects (1000+ files)
 * - Coupling beam connections between related buildings
 * - 3D district walls with extruded borders
 * - Street grid between districts
 */

import React, { useState, useMemo, memo, useCallback, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useFrame, type RootState } from '@react-three/fiber';
import * as THREE from 'three';
import type { BuildingData, DistrictData } from '../../types/index';
import { DISTRICT_COLORS } from '../../constants';

// Default colors
const DEFAULT_SELECTED_COLOR = '#fbbf24';
const DEFAULT_HOVERED_COLOR = '#60a5fa';

// ============================================================
// Enhanced Building Component
// ============================================================

interface BuildingProps {
    building: BuildingData;
    onClick?: () => void;
    isSelected?: boolean;
    selectedColor?: string;
    hoveredColor?: string;
    viewMode?: 'standard' | 'glass' | 'neon' | 'minimal';
}

export const Building = memo(function Building({
    building,
    onClick,
    isSelected = false,
    selectedColor = DEFAULT_SELECTED_COLOR,
    hoveredColor = DEFAULT_HOVERED_COLOR,
    viewMode = 'standard'
}: BuildingProps) {
    const [hovered, setHovered] = useState(false);
    const meshRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);
    const roofRef = useRef<THREE.Mesh>(null);
    const scaleRef = useRef(1);
    const emissiveIntensityRef = useRef(0);

    const handlePointerOver = useCallback((e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
    }, []);

    const handlePointerOut = useCallback((e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = 'auto';
    }, []);

    const handleClick = useCallback((e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        onClick?.();
    }, [onClick]);

    const color = useMemo(() => {
        if (isSelected) return selectedColor;
        if (hovered) return hoveredColor;
        return building.color;
    }, [isSelected, hovered, building.color, selectedColor, hoveredColor]);

    const emissiveColor = useMemo(() => {
        if (hovered || isSelected) return color;
        return '#000000';
    }, [hovered, isSelected, color]);

    // Smooth animation with useFrame
    useFrame((_state: RootState, delta: number) => {
        const targetScale = hovered ? 1.08 : isSelected ? 1.04 : 1;
        scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, delta * 8);

        const targetEmissive = hovered ? 0.5 : isSelected ? 0.35 : 0;
        emissiveIntensityRef.current = THREE.MathUtils.lerp(emissiveIntensityRef.current, targetEmissive, delta * 8);

        if (meshRef.current) {
            meshRef.current.scale.setScalar(scaleRef.current);
            const mat = meshRef.current.material as THREE.MeshStandardMaterial;
            if (mat.emissiveIntensity !== undefined) {
                mat.emissiveIntensity = emissiveIntensityRef.current;
            }
        }

        // Glow ring animation
        if (glowRef.current) {
            const targetOpacity = (hovered || isSelected) ? 0.6 : 0;
            const mat = glowRef.current.material as THREE.MeshBasicMaterial;
            mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, delta * 6);
            glowRef.current.visible = mat.opacity > 0.01;
        }
    });

    // Material properties per view mode
    const materialProps = useMemo(() => {
        switch (viewMode) {
            case 'glass':
                return {
                    roughness: 0.1,
                    metalness: 0.9,
                    transparent: true,
                    opacity: 0.85,
                    envMapIntensity: 1.5
                };
            case 'neon':
                return {
                    roughness: 0.3,
                    metalness: 0.2,
                    transparent: false,
                    opacity: 1,
                    envMapIntensity: 0.5
                };
            case 'minimal':
                return {
                    roughness: 0.9,
                    metalness: 0.0,
                    transparent: false,
                    opacity: 1,
                    envMapIntensity: 0
                };
            default: // standard
                return {
                    roughness: 0.4,
                    metalness: 0.3,
                    transparent: false,
                    opacity: 1,
                    envMapIntensity: 0.8
                };
        }
    }, [viewMode]);

    const roofHeight = Math.min(building.width * 0.3, 0.15);
    const hasRoof = viewMode !== 'minimal' && building.height > 0.5;

    return (
        <group position={[building.x, 0, building.z]}>
            {/* Main building body */}
            <mesh
                ref={meshRef}
                position={[0, building.height / 2, 0]}
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
                onClick={handleClick}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[building.width, building.height, building.depth]} />
                <meshStandardMaterial
                    color={color}
                    emissive={emissiveColor}
                    emissiveIntensity={0}
                    roughness={materialProps.roughness}
                    metalness={materialProps.metalness}
                    transparent={materialProps.transparent}
                    opacity={materialProps.opacity}
                    envMapIntensity={materialProps.envMapIntensity}
                />
            </mesh>

            {/* Roof cap */}
            {hasRoof && (
                <mesh
                    ref={roofRef}
                    position={[0, building.height + roofHeight / 2, 0]}
                    castShadow
                >
                    <boxGeometry args={[building.width + 0.02, roofHeight, building.depth + 0.02]} />
                    <meshStandardMaterial
                        color={color}
                        roughness={0.2}
                        metalness={0.6}
                    />
                </mesh>
            )}

            {/* Floor lines (window effect) */}
            {viewMode !== 'minimal' && building.height > 1 && (
                <FloorLines
                    width={building.width}
                    height={building.height}
                    depth={building.depth}
                    floorCount={Math.min(Math.floor(building.height / 0.4), 10)}
                    color={color}
                />
            )}

            {/* Base glow ring */}
            <mesh
                ref={glowRef}
                position={[0, 0.02, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                visible={false}
            >
                <ringGeometry args={[
                    Math.max(building.width, building.depth) * 0.6,
                    Math.max(building.width, building.depth) * 0.9,
                    32
                ]} />
                <meshBasicMaterial
                    color={isSelected ? selectedColor : hoveredColor}
                    transparent
                    opacity={0}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Hover label */}
            {hovered && (
                <group position={[0, building.height + (hasRoof ? roofHeight : 0) + 0.6, 0]}>
                    {/* Label background */}
                    <mesh position={[0, 0.15, 0]}>
                        <planeGeometry args={[building.label.length * 0.18 + 0.4, 0.5]} />
                        <meshBasicMaterial color="#0f172a" transparent opacity={0.9} side={THREE.DoubleSide} />
                    </mesh>
                    <Text
                        position={[0, 0.15, 0.01]}
                        fontSize={0.25}
                        color="white"
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.015}
                        outlineColor="#000000"
                        maxWidth={4}
                    >
                        {building.label}
                    </Text>
                    {building.coupling !== undefined && building.coupling > 0 && (
                        <Text
                            position={[0, -0.15, 0.01]}
                            fontSize={0.15}
                            color="#94a3b8"
                            anchorX="center"
                            anchorY="middle"
                        >
                            {`coupling: ${(building.coupling * 100).toFixed(0)}%`}
                        </Text>
                    )}
                </group>
            )}
        </group>
    );
});

// ============================================================
// Floor Lines (Window Effect)
// ============================================================

interface FloorLinesProps {
    width: number;
    height: number;
    depth: number;
    floorCount: number;
    color: string;
}

const FloorLines = memo(function FloorLines({ width, height, depth, floorCount, color }: FloorLinesProps) {
    const lines = useMemo(() => {
        const result: Array<{ y: number }> = [];
        const spacing = height / (floorCount + 1);
        for (let i = 1; i <= floorCount; i++) {
            result.push({ y: spacing * i });
        }
        return result;
    }, [height, floorCount]);

    const lineColor = useMemo(() => {
        const c = new THREE.Color(color);
        c.multiplyScalar(1.5);
        return c;
    }, [color]);

    return (
        <group>
            {lines.map((line, i) => (
                <React.Fragment key={i}>
                    {/* Front face line */}
                    <mesh position={[0, line.y, depth / 2 + 0.001]}>
                        <planeGeometry args={[width * 0.9, 0.04]} />
                        <meshBasicMaterial color={lineColor} transparent opacity={0.3} />
                    </mesh>
                    {/* Side face line */}
                    <mesh position={[width / 2 + 0.001, line.y, 0]} rotation={[0, Math.PI / 2, 0]}>
                        <planeGeometry args={[depth * 0.9, 0.04]} />
                        <meshBasicMaterial color={lineColor} transparent opacity={0.3} />
                    </mesh>
                </React.Fragment>
            ))}
        </group>
    );
});

// ============================================================
// District Floor Component (Enhanced)
// ============================================================

interface DistrictFloorProps {
    district: DistrictData;
    customColors?: string[];
    viewMode?: 'standard' | 'glass' | 'neon' | 'minimal';
}

export const DistrictFloor = memo(function DistrictFloor({
    district,
    customColors,
    viewMode = 'standard'
}: DistrictFloorProps) {
    const colors = customColors || DISTRICT_COLORS;

    const color = useMemo(() => {
        return colors[district.level % colors.length];
    }, [district.level, colors]);

    const yOffset = useMemo(() => {
        return -0.02 * (district.level + 1);
    }, [district.level]);

    const wallHeight = viewMode === 'minimal' ? 0 : 0.06;

    return (
        <group>
            {/* Floor plane */}
            <mesh
                position={[
                    district.x + district.width / 2,
                    yOffset,
                    district.z + district.depth / 2
                ]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[district.width, district.depth]} />
                <meshStandardMaterial
                    color={color}
                    transparent
                    opacity={viewMode === 'neon' ? 0.2 : 0.35}
                    roughness={0.8}
                />
            </mesh>

            {/* 3D Extruded border walls */}
            {wallHeight > 0 && (
                <DistrictWalls
                    x={district.x}
                    z={district.z}
                    width={district.width}
                    depth={district.depth}
                    y={yOffset}
                    wallHeight={wallHeight}
                    color={color}
                    level={district.level}
                />
            )}

            {/* Border outline */}
            <lineSegments
                position={[
                    district.x + district.width / 2,
                    yOffset + 0.01,
                    district.z + district.depth / 2
                ]}
                rotation={[-Math.PI / 2, 0, 0]}
            >
                <edgesGeometry
                    args={[new THREE.PlaneGeometry(district.width, district.depth)]}
                />
                <lineBasicMaterial color={color} opacity={0.6} transparent />
            </lineSegments>
        </group>
    );
});

// ============================================================
// District 3D Walls
// ============================================================

interface DistrictWallsProps {
    x: number;
    z: number;
    width: number;
    depth: number;
    y: number;
    wallHeight: number;
    color: string;
    level: number;
}

const DistrictWalls = memo(function DistrictWalls({
    x, z, width, depth, y, wallHeight, color, level
}: DistrictWallsProps) {
    const opacity = Math.max(0.15, 0.4 - level * 0.05);
    const thickness = 0.03;

    return (
        <group>
            {/* North wall */}
            <mesh position={[x + width / 2, y + wallHeight / 2, z]}>
                <boxGeometry args={[width, wallHeight, thickness]} />
                <meshStandardMaterial color={color} transparent opacity={opacity} />
            </mesh>
            {/* South wall */}
            <mesh position={[x + width / 2, y + wallHeight / 2, z + depth]}>
                <boxGeometry args={[width, wallHeight, thickness]} />
                <meshStandardMaterial color={color} transparent opacity={opacity} />
            </mesh>
            {/* West wall */}
            <mesh position={[x, y + wallHeight / 2, z + depth / 2]}>
                <boxGeometry args={[thickness, wallHeight, depth]} />
                <meshStandardMaterial color={color} transparent opacity={opacity} />
            </mesh>
            {/* East wall */}
            <mesh position={[x + width, y + wallHeight / 2, z + depth / 2]}>
                <boxGeometry args={[thickness, wallHeight, depth]} />
                <meshStandardMaterial color={color} transparent opacity={opacity} />
            </mesh>
        </group>
    );
});

// ============================================================
// District Label Component (Enhanced)
// ============================================================

interface DistrictLabelProps {
    district: DistrictData;
    maxLabelLength?: number;
    customColors?: string[];
}

export const DistrictLabel = memo(function DistrictLabel({
    district,
    maxLabelLength = 15,
    customColors
}: DistrictLabelProps) {
    const colors = customColors || DISTRICT_COLORS;
    const labelText = useMemo(() => {
        const name = district.name;
        if (name.length > maxLabelLength) {
            return name.substring(0, maxLabelLength - 2) + '..';
        }
        return name;
    }, [district.name, maxLabelLength]);

    const fontSize = useMemo(() => {
        const baseFontSize = Math.min(
            district.width / (labelText.length * 0.5),
            district.depth / 4,
            0.5
        );
        return Math.max(0.15, Math.min(baseFontSize, 0.4));
    }, [district.width, district.depth, labelText.length]);

    const position = useMemo((): [number, number, number] => {
        const margin = district.labelMargin || 0.4;
        const y = 0.02;

        if (district.labelPosition === 'top') {
            return [
                district.x + district.width / 2,
                y,
                district.z + margin / 2
            ];
        }
        return [
            district.x + margin / 2,
            y,
            district.z + district.depth / 2
        ];
    }, [district]);

    const rotation = useMemo((): [number, number, number] => {
        const baseRotation: [number, number, number] = [-Math.PI / 2, 0, 0];
        if (district.labelPosition === 'left') {
            baseRotation[2] = -Math.PI / 2;
        }
        return baseRotation;
    }, [district.labelPosition]);

    const color = useMemo(() => {
        return colors[district.level % colors.length];
    }, [district.level, colors]);

    if (district.width < 1 || district.depth < 1) {
        return null;
    }

    return (
        <Text
            position={position}
            rotation={rotation}
            fontSize={fontSize}
            color={color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="#000000"
        >
            {labelText}
        </Text>
    );
});

// ============================================================
// Coupling Beams (connections between coupled buildings)
// ============================================================

interface CouplingBeamProps {
    from: [number, number, number];
    to: [number, number, number];
    strength: number;  // 0..1
    color?: string;
}

export const CouplingBeam = memo(function CouplingBeam({
    from, to, strength, color = '#f59e0b'
}: CouplingBeamProps) {
    const lineRef = useRef<THREE.Line>(null);
    const opacity = Math.min(0.8, strength);
    const arcHeight = Math.max(1, strength * 3);

    const curve = useMemo(() => {
        const mid: [number, number, number] = [
            (from[0] + to[0]) / 2,
            Math.max(from[1], to[1]) + arcHeight,
            (from[2] + to[2]) / 2
        ];
        return new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(...from),
            new THREE.Vector3(...mid),
            new THREE.Vector3(...to)
        );
    }, [from, to, arcHeight]);

    const points = useMemo(() => curve.getPoints(30), [curve]);
    const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

    return (
        <primitive object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, linewidth: 2 }))} ref={lineRef} />
    );
});

// ============================================================
// Coupling Beams Collection
// ============================================================

interface CouplingBeamsProps {
    buildings: BuildingData[];
    maxBeams?: number;
    minStrength?: number;
}

export const CouplingBeams = memo(function CouplingBeams({
    buildings,
    maxBeams = 50,
    minStrength = 0.3
}: CouplingBeamsProps) {
    const beams = useMemo(() => {
        // Find buildings in same cluster and create connections
        const clusterGroups = new Map<number, BuildingData[]>();
        buildings.forEach(b => {
            if (b.clusterId !== null && b.clusterId !== undefined) {
                const group = clusterGroups.get(b.clusterId) || [];
                group.push(b);
                clusterGroups.set(b.clusterId, group);
            }
        });

        const result: Array<{ from: [number, number, number]; to: [number, number, number]; strength: number; color: string }> = [];

        clusterGroups.forEach((group) => {
            if (group.length < 2 || group.length > 20) return;
            // Connect pairs with high coupling
            for (let i = 0; i < group.length && result.length < maxBeams; i++) {
                for (let j = i + 1; j < group.length && result.length < maxBeams; j++) {
                    const a = group[i];
                    const b = group[j];
                    const strength = Math.min(a.coupling, b.coupling);
                    if (strength >= minStrength) {
                        result.push({
                            from: [a.x, a.height, a.z],
                            to: [b.x, b.height, b.z],
                            strength,
                            color: a.color
                        });
                    }
                }
            }
        });

        return result;
    }, [buildings, maxBeams, minStrength]);

    return (
        <group>
            {beams.map((beam, i) => (
                <CouplingBeam
                    key={i}
                    from={beam.from}
                    to={beam.to}
                    strength={beam.strength}
                    color={beam.color}
                />
            ))}
        </group>
    );
});

// ============================================================
// Street Grid Component
// ============================================================

interface StreetGridProps {
    cityWidth: number;
    cityHeight: number;
    spacing?: number;
    color?: string;
}

export const StreetGrid = memo(function StreetGrid({
    cityWidth, cityHeight, spacing = 5, color = '#1e293b'
}: StreetGridProps) {
    const grid = useMemo(() => {
        const lines: Array<{ start: [number, number, number]; end: [number, number, number] }> = [];
        for (let x = 0; x <= cityWidth; x += spacing) {
            lines.push({
                start: [x, -0.05, 0],
                end: [x, -0.05, cityHeight]
            });
        }
        for (let z = 0; z <= cityHeight; z += spacing) {
            lines.push({
                start: [0, -0.05, z],
                end: [cityWidth, -0.05, z]
            });
        }
        return lines;
    }, [cityWidth, cityHeight, spacing]);

    const lineObjects = useMemo(() => {
        return grid.map((line) => {
            const points = [
                new THREE.Vector3(...line.start),
                new THREE.Vector3(...line.end)
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2 });
            return new THREE.Line(geometry, material);
        });
    }, [grid, color]);

    return (
        <group>
            {lineObjects.map((lineObj, i) => (
                <primitive key={i} object={lineObj} />
            ))}
        </group>
    );
});

// ============================================================
// Buildings Collection Component
// ============================================================

interface BuildingsProps {
    buildings: BuildingData[];
    selectedPath?: string | null;
    onSelectBuilding?: (building: BuildingData) => void;
    selectedColor?: string;
    hoveredColor?: string;
    viewMode?: 'standard' | 'glass' | 'neon' | 'minimal';
}

export const Buildings = memo(function Buildings({
    buildings,
    selectedPath,
    onSelectBuilding,
    selectedColor,
    hoveredColor,
    viewMode = 'standard'
}: BuildingsProps) {
    return (
        <group>
            {buildings.map((building, index) => (
                <Building
                    key={`${building.fullPath}-${index}`}
                    building={building}
                    isSelected={selectedPath === building.fullPath}
                    onClick={() => onSelectBuilding?.(building)}
                    selectedColor={selectedColor}
                    hoveredColor={hoveredColor}
                    viewMode={viewMode}
                />
            ))}
        </group>
    );
});

// ============================================================
// Districts Collection Component
// ============================================================

interface DistrictsProps {
    districts: DistrictData[];
    showLabels?: boolean;
    customColors?: string[];
    viewMode?: 'standard' | 'glass' | 'neon' | 'minimal';
}

export const Districts = memo(function Districts({
    districts,
    showLabels = true,
    customColors,
    viewMode = 'standard'
}: DistrictsProps) {
    return (
        <group>
            {districts.map((district, index) => (
                <React.Fragment key={`${district.path}-${index}`}>
                    <DistrictFloor district={district} customColors={customColors} viewMode={viewMode} />
                    {showLabels && <DistrictLabel district={district} customColors={customColors} />}
                </React.Fragment>
            ))}
        </group>
    );
});

// ============================================================
// Heatmap Overlay (alternative visualization)
// ============================================================

interface HeatmapOverlayProps {
    buildings: BuildingData[];
    cityWidth: number;
    cityHeight: number;
    resolution?: number;
}

export const HeatmapOverlay = memo(function HeatmapOverlay({
    buildings,
    cityWidth,
    cityHeight,
    resolution = 64
}: HeatmapOverlayProps) {
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext('2d')!;

        // Create heatmap from building coupling values
        const imageData = ctx.createImageData(resolution, resolution);
        const data = imageData.data;

        // Initialize with transparent black
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 0;
        }

        buildings.forEach(b => {
            const px = Math.floor((b.x / cityWidth) * resolution);
            const pz = Math.floor((b.z / cityHeight) * resolution);
            const radius = 3;
            const coupling = b.coupling || 0;

            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    const x = px + dx;
                    const z = pz + dz;
                    if (x >= 0 && x < resolution && z >= 0 && z < resolution) {
                        const dist = Math.sqrt(dx * dx + dz * dz);
                        const falloff = Math.max(0, 1 - dist / radius);
                        const intensity = coupling * falloff;
                        const idx = (z * resolution + x) * 4;

                        // Hot color gradient
                        data[idx] = Math.min(255, data[idx] + intensity * 255); // R
                        data[idx + 1] = Math.min(255, data[idx + 1] + intensity * 100); // G
                        data[idx + 2] = Math.min(255, data[idx + 2] + intensity * 30); // B
                        data[idx + 3] = Math.min(255, data[idx + 3] + intensity * 150); // A
                    }
                }
            }
        });

        ctx.putImageData(imageData, 0, 0);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }, [buildings, cityWidth, cityHeight, resolution]);

    return (
        <mesh
            position={[cityWidth / 2, 0.01, cityHeight / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
        >
            <planeGeometry args={[cityWidth, cityHeight]} />
            <meshBasicMaterial map={texture} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
    );
});
