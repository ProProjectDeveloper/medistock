import tokens from './tokens.json';

export type ThemeName = 'light' | 'dark';
export type ColorToken = keyof typeof tokens.color.light;

/** Raw design tokens, shared by web (CSS variables) and mobile (theme object). */
export { tokens };
export const colors = tokens.color;
export const fontSize = tokens.fontSize;
export const space = tokens.space;
export const radius = tokens.radius;
export const layout = tokens.layout;
export const motion = tokens.motion;
