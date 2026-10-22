import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        line: 'var(--border)',
        ink: 'var(--text)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        'success-bg': 'var(--success-bg)',
        warning: 'var(--warning)',
        'warning-bg': 'var(--warning-bg)',
        danger: 'var(--danger)',
        'danger-bg': 'var(--danger-bg)',
        info: 'var(--info)',
        'info-bg': 'var(--info-bg)',
        // Direct tokens from the maternal-care mockups
        'accent-deep': '#780037', // primary (hover/deep berry)
        'accent-soft': '#ffd9e0', // primary-fixed
        'rose-bg': '#fff5f7', // soft help-card background
        'lav-low': '#f1f3ff', // surface-container-low
        lav: '#e9edff', // surface-container
        'lav-high': '#e1e8fd', // surface-container-high
        'green-deep': '#008a38', // confirmation hero green
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        input: '8px',
        card: '16px',
        dialog: '16px',
        panel: '24px',
      },
      boxShadow: {
        card: '0 2px 6px -1px rgba(17,24,39,.04), 0 1px 2px rgba(17,24,39,.03)',
        dialog: '0 8px 20px -4px rgba(157,23,77,.06), 0 4px 8px -2px rgba(17,24,39,.04)',
        lift: '0 12px 28px -6px rgba(17,24,39,.12)',
      },
    },
  },
  plugins: [],
}

export default config
