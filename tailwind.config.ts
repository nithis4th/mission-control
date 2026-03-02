import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'mc-bg': '#060a13',
        'mc-bg-secondary': '#0b1221',
        'mc-bg-tertiary': '#111c32',
        'mc-border': '#1a2d4a',
        'mc-text': '#cce0ff',
        'mc-text-secondary': '#5a7da8',
        'mc-accent': '#00d4ff',
        'mc-accent-green': '#00ff9d',
        'mc-accent-yellow': '#ffc107',
        'mc-accent-red': '#ff3b5c',
        'mc-accent-purple': '#b07aff',
        'mc-accent-pink': '#ff5c93',
        'mc-accent-cyan': '#00d4ff',
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(0,212,255,0.25), 0 0 40px rgba(0,212,255,0.08)',
        'glow-green': '0 0 15px rgba(0,255,157,0.25), 0 0 40px rgba(0,255,157,0.08)',
        'glow-red': '0 0 15px rgba(255,59,92,0.3), 0 0 40px rgba(255,59,92,0.1)',
        'glow-purple': '0 0 15px rgba(176,122,255,0.25), 0 0 40px rgba(176,122,255,0.08)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'neon-pulse': 'neon-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'neon-pulse': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0,212,255,0.2)' },
          '50%': { boxShadow: '0 0 25px rgba(0,212,255,0.4)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
