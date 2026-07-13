import type { Config } from 'tailwindcss';

/**
 * APEX design system — an institutional "compute exchange" aesthetic inspired by
 * ornn.com: minimal, data-forward, generous whitespace, uppercase mono labels,
 * warm amber accent over a near-black terminal with cream "paper" surfaces.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark terminal surfaces
        ink: {
          900: '#08080A', // page background
          800: '#0D0E11', // raised surface
          700: '#131519', // card
          600: '#1B1E24', // input / hover
          500: '#272B33', // border-strong
        },
        line: 'rgba(255,255,255,0.08)', // hairline borders
        // Warm cream "paper" for landing contrast sections
        paper: {
          DEFAULT: '#F4F0E8',
          soft: '#EDE7DA',
          ink: '#14130F',
        },
        // Warm forge accent
        accent: {
          DEFAULT: '#FF6A2B',
          soft: '#FF8A56',
          dim: '#B8461B',
        },
        ember: '#F5A623',
        // Semantic
        up: '#3FD98B',
        down: '#FF5C6C',
        muted: '#8A8F99',
        subtle: '#5A5F69',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'label': ['11px', { lineHeight: '1.2', letterSpacing: '0.12em' }],
      },
      borderRadius: {
        card: '10px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 30px -12px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px rgba(255,106,43,0.4), 0 0 30px -6px rgba(255,106,43,0.5)',
        pop: '0 20px 60px -20px rgba(0,0,0,0.8)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'ember-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.22,1,0.36,1) both',
        'marquee': 'marquee 40s linear infinite',
        'ember-pulse': 'ember-pulse 2.4s ease-in-out infinite',
        'shimmer': 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
