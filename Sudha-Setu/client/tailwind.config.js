/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14261F',
        muted: '#5C6B63',
        paper: '#FBFAF7',
        sage: '#E7EDE6',
        line: '#D6DED4',
        tulsi: { DEFAULT: '#2F6B4F', deep: '#245540' },
        // Triage colours are safety-critical, not decorative.
        tier: { low: '#1F7A4C', med: '#B45309', high: '#B3261E' },
      },
      fontFamily: {
        sans: ['"Noto Sans Devanagari"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif Devanagari"', 'ui-serif', 'Georgia', 'serif'],
      },
      maxWidth: { reading: '68ch' },
    },
  },
  plugins: [],
};
