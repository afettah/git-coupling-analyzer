/**
 * 3D Building Components for ProjectCity
 */

import React, { useState, useMemo, memo, useCallback, useRef } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { BuildingData, DistrictData } from '../../types/index';
import { DISTRICT_COLORS } from '../../constants';

// Default colors
const DEFAULT_SELECTED_COLOR = '#fbbf24';
const DEFAULT_HOVERED_COLOR = '#60a5fa';

// ============================================================
// Building Component
// ============================================================

interface BuildingProps {
    building: BuildingData;
    onClick?: () => void;
    isSelected?: boolean;
    selectedColor?: string;
    hoveredColor?: string;
}

export const Building = memo(function Building({
    building,
    onClick,
    isSelected = false,
    selectedColor = DEFAULT_SELECTED_COLOR,
    hoveredColor = DEFAULT_HOVERED_COLOR
}: BuildingProps) {
    const [hovered, setHovered] = useState(false);
    const meshRef = useRef<THREE.Mesh>(null);

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

    const emissive = useMemo(() => {
        if (hovered || isSelected) return color;
        return '#000000';
    }, [hovered, isSelected, color]);

    return (
        <group position={[building.x, 0, building.z]}>
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
                    emissive={emissive}
                    emissiveIntensity={hovered || isSelected ? 0.3 : 0}
                    roughness={0.5}
                    metalness={0.1}
                />
            </mesh>

            {hovered && (
                <Text
                    position={[0, building.height + 0.5, 0]}
                    fontSize={0.3}
                    color="white"
                    anchorX="center"
                    anchorY="bottom"
                    outlineWidth={0.02}
                    outlineColor="#000000"
                >
                    {building.label}
                </Text>
            )}
        </group>
    );
});

// ============================================================
// District Floor Component
// ============================================================

interface DistrictFloorProps {
    district: DistrictData;
    customColors?: string[];
}

export const DistrictFloor = memo(function DistrictFloor({
    district,
    customColors
}: DistrictFloorProps) {
    const colors = customColors || DISTRICT_COLORS;

    const color = useMemo(() => {
        return colors[district.level % colors.length];
    }, [district.level, colors]);

    const yOffset = useMemo(() => {
        return -0.02 * (district.level + 1);
    }, [district.level]);

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
                    opacity={0.4}
                    roughness={0.8}
                />
            </mesh>

            {/* Border */}
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
// District Label Component
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
// Buildings Collection Component
// ============================================================

interface BuildingsProps {
    buildings: BuildingData[];
    selectedPath?: string | null;
    onSelectBuilding?: (building: BuildingData) => void;
    selectedColor?: string;
    hoveredColor?: string;
}

export const Buildings = memo(function Buildings({
    buildings,
    selectedPath,
    onSelectBuilding,
    selectedColor,
    hoveredColor
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
}

export const Districts = memo(function Districts({
    districts,
    showLabels = true,
    customColors
}: DistrictsProps) {
    return (
        <group>
            {districts.map((district, index) => (
                <React.Fragment key={`${district.path}-${index}`}>
                    <DistrictFloor district={district} customColors={customColors} />
                    {showLabels && <DistrictLabel district={district} customColors={customColors} />}
                </React.Fragment>
            ))}
        </group>
    );
});
