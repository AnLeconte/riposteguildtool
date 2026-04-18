/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      animation: {
        shimmer: 'shimmer 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.35s ease-out both',
        'fade-in-up': 'fadeInUp 0.35s ease-out both',
        'fade-in-down': 'fadeInDown 0.25s ease-out both',
        'scale-in': 'scaleIn 0.2s ease-out both',
        'backdrop-in': 'backdropIn 0.2s ease-out both',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-out': 'fadeOut 0.25s ease-in both',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        backdropIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(8px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 209, 0, 0.1)' },
          '100%': { boxShadow: '0 0 20px rgba(255, 209, 0, 0.15)' },
        },
      },
      colors: {
        wow: {
          gold: '#FFD100',
          'gold-light': '#FFE066',
          dark: '#12121f',
          darker: '#0a0a14',
          panel: '#141425',
          accent: '#1a1a3e',
          blue: '#4a9eff',
          surface: '#1c1c32',
        },
        class: {
          warrior: '#C79C6E',
          paladin: '#F58CBA',
          hunter: '#ABD473',
          rogue: '#FFF569',
          priest: '#FFFFFF',
          'death-knight': '#C41F3B',
          shaman: '#0070DE',
          mage: '#69CCF0',
          warlock: '#9482C9',
          monk: '#00FF96',
          druid: '#FF7D0A',
          'demon-hunter': '#A330C9',
          evoker: '#33937F',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gold-gradient': 'linear-gradient(135deg, #FFD100 0%, #FFA500 100%)',
      },
      boxShadow: {
        'gold-sm': '0 0 10px rgba(255, 209, 0, 0.1)',
        'gold-md': '0 0 20px rgba(255, 209, 0, 0.15)',
        'gold-lg': '0 0 40px rgba(255, 209, 0, 0.2)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      },
    },
  },
  plugins: [],
}
