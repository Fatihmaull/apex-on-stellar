import type { Config } from 'tailwindcss';

/**
 * APEX design system — a monochrome, editorial "financial infrastructure"
 * aesthetic modeled on ornn.com: pure black canvas, off-white type, a full
 * greyscale hierarchy, mono micro-labels, restrained grotesque headings, and
 * near-zero colour. Colour is reserved almost entirely for trading PnL (up/down).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Canvas + raised surfaces (near-black steps).
        ink: {
          900: '#000000', // page
          800: '#0A0A0B', // section / raised
          700: '#121213', // card (ornn #121213)
          600: '#1B1C1F', // input / hover
          500: '#26272B', // strong border / chip (ornn #26272B)
        },
        line: 'rgba(255,255,255,0.10)', // hairline border
        // Light "paper" sections (ornn alternates to #F3F3F3).
        paper: {
          DEFAULT: '#F3F3F3',
          soft: '#E7E7E7',
          ink: '#0A0A0B',
          line: 'rgba(0,0,0,0.10)',
        },
        // Foreground greyscale (ornn ramp).
        fg: {
          DEFAULT: '#F3F3F3', // primary text
          muted: '#B2B8C0',
          dim: '#949BA5',
          faint: '#6F7681',
          ghost: '#3D4045',
        },
        // Emphasis = brightness, not hue. "accent" is pure white.
        accent: {
          DEFAULT: '#FFFFFF',
          soft: '#F3F3F3',
        },
        // Trading semantics only — deliberately muted.
        up: '#5BD08B',
        down: '#F2556C',
        ember: '#C9A227', // caution / paused (restrained gold)
        // muted alias kept for legacy component classes
        muted: '#949BA5',
        subtle: '#6F7681',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        label: ['11px', { lineHeight: '1.3', letterSpacing: '0.14em' }],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      borderRadius: {
        card: '6px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset',
        pop: '0 24px 70px -24px rgba(0,0,0,0.9)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both',
        marquee: 'marquee 46s linear infinite',
        blink: 'blink 1.6s steps(1) infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
