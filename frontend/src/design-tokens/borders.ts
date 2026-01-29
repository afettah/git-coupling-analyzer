/**
 * Border Design Tokens
 * 
 * Border radii and widths for consistent styling.
 */

export const borderRadius = {
    none: '0',
    sm: '0.25rem',    // 4px
    DEFAULT: '0.375rem', // 6px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
    '2xl': '1.5rem',  // 24px
    '3xl': '2rem',    // 32px
    full: '9999px',
} as const;

export const borderWidth = {
    0: '0',
    DEFAULT: '1px',
    2: '2px',
    4: '4px',
    8: '8px',
} as const;

export type BorderRadiusToken = keyof typeof borderRadius;
export type BorderWidthToken = keyof typeof borderWidth;
