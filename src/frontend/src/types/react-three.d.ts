/**
 * Type declarations for @react-three/fiber and @react-three/drei
 * These override the default types to fix import issues
 */

declare module '@react-three/fiber' {
    import { ReactNode, RefObject } from 'react';
    import * as THREE from 'three';

    export interface RootState {
        clock: THREE.Clock;
        camera: THREE.Camera;
        scene: THREE.Scene;
        gl: THREE.WebGLRenderer;
        size: { width: number; height: number };
        mouse: THREE.Vector2;
        pointer: THREE.Vector2;
        raycaster: THREE.Raycaster;
    }

    export function useFrame(callback: (state: RootState, delta: number) => void): void;
    export function useThree(): RootState;

    export interface CanvasProps {
        children?: ReactNode;
        shadows?: boolean;
        camera?: {
            position?: [number, number, number];
            fov?: number;
            near?: number;
            far?: number;
        };
        style?: React.CSSProperties;
        gl?: {
            antialias?: boolean;
            alpha?: boolean;
            powerPreference?: string;
        };
    }

    export function Canvas(props: CanvasProps): JSX.Element;

    export function extend(objects: Record<string, unknown>): void;
}

declare module '@react-three/drei' {
    import { ReactNode } from 'react';
    import * as THREE from 'three';

    export interface TextProps {
        children?: ReactNode;
        position?: [number, number, number];
        rotation?: [number, number, number];
        fontSize?: number;
        color?: string;
        anchorX?: 'left' | 'center' | 'right';
        anchorY?: 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom';
        outlineWidth?: number;
        outlineColor?: string;
        maxWidth?: number;
    }

    export function Text(props: TextProps): JSX.Element;

    export interface OrbitControlsProps {
        target?: THREE.Vector3 | [number, number, number];
        autoRotate?: boolean;
        autoRotateSpeed?: number;
        minDistance?: number;
        maxDistance?: number;
        maxPolarAngle?: number;
        enableDamping?: boolean;
        dampingFactor?: number;
        zoomSpeed?: number;
    }

    export function OrbitControls(props: OrbitControlsProps): JSX.Element;

    export interface EnvironmentProps {
        preset?: 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'city' | 'park' | 'lobby';
        background?: boolean;
    }

    export function Environment(props: EnvironmentProps): JSX.Element;

    export interface StarsProps {
        radius?: number;
        depth?: number;
        count?: number;
        factor?: number;
        saturation?: number;
        fade?: boolean;
        speed?: number;
    }

    export function Stars(props: StarsProps): JSX.Element;

    export interface FloatProps {
        children?: ReactNode;
        speed?: number;
        rotationIntensity?: number;
        floatIntensity?: number;
    }

    export function Float(props: FloatProps): JSX.Element;
}
