/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'media',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // iOS System Colors
        'ios-blue':   '#007AFF',
        'ios-green':  '#34C759',
        'ios-red':    '#FF3B30',
        'ios-orange': '#FF9500',
        'ios-yellow': '#FFCC00',
        'ios-purple': '#AF52DE',
        'ios-pink':   '#FF2D55',
        'ios-teal':   '#5AC8FA',
        'ios-indigo': '#5856D6',
        // Body-part accent colors (used in calendar / badges)
        bp: {
          chest:     '#FF3B30',
          back:      '#007AFF',
          shoulders: '#FFCC00',
          legs:      '#34C759',
          arms:      '#AF52DE',
          core:      '#FF2D55',
          cardio:    '#FF9500',
        },
        // Semantic backgrounds (light)
        'sys-bg':        '#F2F2F7',
        'sys-bg2':       '#FFFFFF',
        'sys-bg3':       '#E5E5EA',
        'sys-fill':      '#787880',
        'sys-fill2':     '#78788028',
        'sys-separator': '#C6C6C8',
        // Semantic labels (light)
        'sys-label':    '#000000',
        'sys-label2':   '#3C3C4399',
        'sys-label3':   '#3C3C434D',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        ios:    '10px',
        'ios-lg': '16px',
        'ios-xl': '20px',
      },
      boxShadow: {
        'ios-sm':   '0 1px 3px rgba(0,0,0,0.08)',
        'ios-card': '0 2px 12px rgba(0,0,0,0.08)',
        'ios-modal':'0 -4px 24px rgba(0,0,0,0.12)',
      },
      spacing: {
        'tab-bar': '83px',  // 49px bar + ~34px home indicator
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 34px)',
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
}
