/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rhip: {
          dark: '#0D2137',
          navy: '#1A3A5C',
          teal: '#028090',
          seafoam: '#00A896',
          lightTeal: '#E8F7F8',
          coral: '#D85A30',
          amber: '#E67E22',
          white: '#FFFFFF',
          body: '#2D3748',
          muted: '#718096',
          lightBg: '#F5F9FA',
          cardBg: '#EBF4F5',
          ice: '#CADCFC',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Lora', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
