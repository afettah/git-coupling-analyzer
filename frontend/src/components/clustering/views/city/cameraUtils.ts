/**
 * Camera Controls for ProjectCity
 */

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

// ============================================================
// Camera Controller Hook
// ============================================================

interface UseCameraControllerOptions {
    autoRotate?: boolean;
    autoRotateSpeed?: number;
    minDistance?: number;
    maxDistance?: number;
    minPolarAngle?: number;
    maxPolarAngle?: number;
    enableDamping?: boolean;
    dampingFactor?: number;
}

export function useCameraController(options: UseCameraControllerOptions = {}) {
    const {
        autoRotate = false,
        autoRotateSpeed = 0.5,
        minDistance = 5,
        maxDistance = 100,
        minPolarAngle = 0,
        maxPolarAngle = Math.PI / 2.5,
        enableDamping = true,
        dampingFactor = 0.05
    } = options;

    const controlsRef = useRef<OrbitControlsImpl>(null);
    const { camera, gl } = useThree();

    useEffect(() => {
        const controls = controlsRef.current;
        if (controls) {
            controls.autoRotate = autoRotate;
            controls.autoRotateSpeed = autoRotateSpeed;
            controls.minDistance = minDistance;
            controls.maxDistance = maxDistance;
            controls.minPolarAngle = minPolarAngle;
            controls.maxPolarAngle = maxPolarAngle;
            controls.enableDamping = enableDamping;
            controls.dampingFactor = dampingFactor;
        }
    }, [
        autoRotate, autoRotateSpeed,
        minDistance, maxDistance,
        minPolarAngle, maxPolarAngle,
        enableDamping, dampingFactor
    ]);

    return {
        controlsRef,
        camera,
        domElement: gl.domElement
    };
}

// ============================================================
// Camera Position Calculator
// ============================================================

export function calculateCameraPosition(
    cityWidth: number,
    cityHeight: number
): { position: [number, number, number]; target: [number, number, number] } {
    const maxDimension = Math.max(cityWidth, cityHeight);
    const distance = maxDimension * 0.8;

    return {
        position: [
            cityWidth / 2,
            distance,
            cityHeight / 2 + distance * 0.5
        ],
        target: [cityWidth / 2, 0, cityHeight / 2]
    };
}

// ============================================================
// Focus on Building
// ============================================================

export function focusOnPosition(
    controls: OrbitControlsImpl | null,
    position: [number, number, number],
    distance: number = 5
): void {
    if (!controls) return;

    const [x, y, z] = position;

    // Animate target
    controls.target.set(x, y, z);

    // Update camera position
    const camera = controls.object;
    camera.position.set(
        x + distance,
        y + distance,
        z + distance
    );

    controls.update();
}
