/**
 * Camera Controls for ProjectCity
 */

import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

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
