/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rhip: {
          dark: 'var(--rhip-dark)',
          navy: 'var(--rhip-navy)',
          teal: 'var(--rhip-teal)',
          'teal-hover': 'var(--rhip-teal-hover)',
          seafoam: 'var(--rhip-seafoam)',
          lightTeal: 'var(--rhip-lightTeal)',
          mint: 'var(--rhip-lightTeal)',
          coral: 'var(--rhip-coral)',
          amber: 'var(--rhip-amber)',
          white: 'var(--rhip-white)',
          body: 'var(--rhip-body)',
          muted: 'var(--rhip-muted)',
          lightBg: 'var(--rhip-lightBg)',
          cardBg: 'var(--rhip-cardBg)',
          border: 'var(--rhip-border)',
          ring: 'var(--rhip-ring)',
          ice: 'var(--rhip-ice)',
          'on-dark-muted': 'var(--rhip-on-dark-muted)',
          'sidebar-border': 'var(--rhip-sidebar-border)',
        },
      },
      fontFamily: {
        sans: ['var(--rhip-font-sans)'],
        display: ['var(--rhip-font-display)'],
      },
      borderRadius: {
        rhip: 'var(--rhip-radius-lg)',
        'rhip-xl': 'var(--rhip-radius-xl)',
      },
      boxShadow: {
        rhip: 'var(--rhip-shadow-md)',
        'rhip-lg': 'var(--rhip-shadow-lg)',
      },
    },
  },
  plugins: [],
}
