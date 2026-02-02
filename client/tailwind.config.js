/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light Modern Mono Palette
        'game-bg': '#fafafa',
        'game-primary': '#ffffff',
        'game-secondary': '#f5f5f5',
        'game-tertiary': '#eeeeee',
        'game-accent': '#1a1a1a',
        'game-accent-dim': '#404040',
        'game-accent-bright': '#000000',
        'game-accent-alt': '#2563eb',
        'game-success': '#16a34a',
        'game-warning': '#d97706',
        'game-danger': '#dc2626',
        'game-danger-dim': '#b91c1c',
        'game-info': '#2563eb',
        'game-text': '#171717',
        'game-text-dim': '#404040',
        'game-text-muted': '#737373',
        'game-border': '#d4d4d4',
        'game-border-light': '#a3a3a3',
        'game-border-accent': 'rgba(26, 26, 26, 0.3)',
      },
      boxShadow: {
        'glow-accent': '0 0 20px rgba(26, 26, 26, 0.15), 0 0 40px rgba(26, 26, 26, 0.05)',
        'glow-accent-strong': '0 0 30px rgba(26, 26, 26, 0.25), 0 0 60px rgba(26, 26, 26, 0.1)',
        'glow-danger': '0 0 20px rgba(220, 38, 38, 0.3)',
        'glow-success': '0 0 15px rgba(22, 163, 74, 0.3)',
        'inner-light': 'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        'panel': '0 4px 24px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.1)',
        'panel-hover': '0 8px 32px rgba(0, 0, 0, 0.12), 0 0 2px rgba(0, 0, 0, 0.15)',
      },
      animation: {
        'subtle-pulse': 'subtle-pulse 3s ease-in-out infinite',
        'scan-line': 'scan-line 4s linear infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'glow': 'glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'data-stream': 'data-stream 3s linear infinite',
        'border-glow': 'border-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'subtle-pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'fade-in': {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(26, 26, 26, 0.1)' },
          '50%': { boxShadow: '0 0 20px rgba(26, 26, 26, 0.2)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'data-stream': {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '0% 100%' },
        },
        'border-glow': {
          '0%, 100%': {
            boxShadow: '0 0 5px rgba(26, 26, 26, 0.1), inset 0 0 5px rgba(26, 26, 26, 0.02)'
          },
          '50%': {
            boxShadow: '0 0 15px rgba(26, 26, 26, 0.2), inset 0 0 10px rgba(26, 26, 26, 0.05)'
          },
        },
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Consolas', 'monospace'],
        'display': ['Rajdhani', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'tactical-grid': `
          linear-gradient(rgba(0, 0, 0, 0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 0, 0, 0.06) 1px, transparent 1px)
        `,
        'contour-lines': `
          repeating-radial-gradient(circle at 30% 40%, transparent 0px, transparent 30px, rgba(0, 0, 0, 0.04) 30px, rgba(0, 0, 0, 0.04) 31px),
          repeating-radial-gradient(circle at 70% 60%, transparent 0px, transparent 45px, rgba(0, 0, 0, 0.03) 45px, rgba(0, 0, 0, 0.03) 46px)
        `,
      },
      backgroundSize: {
        'grid-20': '20px 20px',
        'grid-40': '40px 40px',
      },
    },
  },
  plugins: [],
}
