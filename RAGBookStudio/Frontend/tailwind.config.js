/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        glass: {
          50: 'rgba(255, 255, 255, 0.05)',
          100: 'rgba(255, 255, 255, 0.1)',
          200: 'rgba(255, 255, 255, 0.15)',
          300: 'rgba(255, 255, 255, 0.2)',
        },
        brand: {
          50:  '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
          950: '#500724',
        },
        purple: {
          50:  '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
        },
      },
      backgroundImage: {
        'purple-gradient': 'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f472b6 100%)',
        'pink-gradient': 'linear-gradient(135deg, #ec4899 0%, #f9a8d4 100%)',
        'purple-pink-soft': 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 50%, #fce7f3 100%)',
        'purple-pink-dark': 'linear-gradient(135deg, #1e1033 0%, #2d1b3d 40%, #3b1248 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(236,72,153,0.06) 100%)',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(168, 85, 247, 0.12)',
        'glass-lg': '0 12px 40px 0 rgba(236, 72, 153, 0.18)',
        'pink-glow': '0 0 24px rgba(236, 72, 153, 0.35)',
        'purple-glow': '0 0 24px rgba(168, 85, 247, 0.35)',
      },
      backdropBlur: {
        glass: '16px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
