import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'day-bg': 'var(--day-bg)',
        'day-surface': 'var(--day-surface)',
        'day-accent': 'var(--day-accent)',
        'day-text': 'var(--day-text-on-bg)',
      },
      borderRadius: {
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
} satisfies Config
