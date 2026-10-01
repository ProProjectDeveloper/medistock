import tokens from '../../packages/tokens/tokens.json' with { type: 'json' };

// Every colour token becomes a Tailwind colour backed by its CSS variable, so light/dark switch at runtime.
const colors = Object.fromEntries(Object.keys(tokens.color.light).map((k) => [k, `var(--${k})`]));
const px = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, `${v}px`]));

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: { ...colors, transparent: 'transparent', current: 'currentColor' },
      fontFamily: { display: 'var(--font-display)', body: 'var(--font-body)', mono: 'var(--font-mono)' },
      fontSize: px(tokens.fontSize),
      borderRadius: { sm: '6px', md: '10px', lg: '16px', pill: '999px' },
      boxShadow: { raised: 'var(--shadow-raised)', overlay: 'var(--shadow-overlay)' },
      transitionTimingFunction: { brand: 'cubic-bezier(.2,.7,.2,1)' },
      maxWidth: { content: '1320px' },
      width: { sidebar: '248px' },
    },
  },
  plugins: [],
};
