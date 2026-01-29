/**
 * Shadow Design Tokens
 * 
 * Box shadow definitions for elevation.
 */

export const shadows = {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    none: 'none',

    // Glow effects
    glow: {
        sky: '0 0 20px rgb(56 189 248 / 0.2)',
        emerald: '0 0 20px rgb(34 197 94 / 0.2)',
        amber: '0 0 20px rgb(250 204 21 / 0.2)',
        rose: '0 0 20px rgb(244 63 94 / 0.2)',
    },
} as const;

export type ShadowToken = keyof typeof shadows;
