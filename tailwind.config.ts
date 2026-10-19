import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#070b14',
        panel: '#0d1424',
        panel2: '#111a2e',
        edge: '#1c2740',
        up: '#16c784',
        down: '#ea3943',
        accent: '#FF9933',
        accentdeep: '#FF6B1A',
        accent2: 'var(--accent2, #22D3EE)',
        cyanx: '#22d3ee',
      },
    },
  },
  plugins: [],
};
export default config;
