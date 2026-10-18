/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Tinted neutrals: slate blended 2-4% toward the indigo anchor hue.
        slate: {
          50: '#f2f7fc',
          100: '#e8f1f9',
          200: '#d9e3f1',
          300: '#c3d1e2',
          400: '#8fa1bb',
          500: '#61738f',
          600: '#44566e',
          700: '#31425a',
          800: '#1d2b41',
          900: '#0f192f',
          950: '#04091b',
        },
        // Momentum (triad +120): completion, progress, active workflow.
        momentum: {
          50: '#fff1dd',
          100: '#ffe4c8',
          200: '#ffcca4',
          400: '#df8537',
          600: '#a65000',
          900: '#6a3b10',
        },
        // Attention (triad +240): alerts, unread badges, active timers.
        attention: {
          50: '#e6fbf7',
          100: '#d4f1eb',
          200: '#b5e0d8',
          400: '#4caa9d',
          600: '#00776a',
          900: '#1b4f47',
        },
      },
      boxShadow: {
        // Soft, anchor-tinted elevation glows replacing achromatic shadows.
        'glow-sm': '0 1px 3px -1px rgb(79 70 229 / 0.18), 0 0 8px -2px rgb(79 70 229 / 0.10)',
        'glow-md': '0 4px 16px -4px rgb(79 70 229 / 0.22), 0 0 12px -3px rgb(79 70 229 / 0.12)',
      },
    },
  },
  plugins: [],
};
