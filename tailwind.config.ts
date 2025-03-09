/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-light': 'var(--primary-light)',
        'primary-dark': 'var(--primary-dark)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card-background)',
        border: 'var(--border-color)',
        success: 'var(--success)',
        'success-light': 'var(--success-light)',
        'success-dark': 'var(--success-dark)',
        error: 'var(--error)',
        'error-light': 'var(--error-light)',
        'error-dark': 'var(--error-dark)',
        warning: 'var(--warning)',
        info: 'var(--info)',
        'syntax-added-bg': 'var(--syntax-added-bg)',
        'syntax-added-text': 'var(--syntax-added-text)',
        'syntax-added-border': 'var(--syntax-added-border)',
        'syntax-removed-bg': 'var(--syntax-removed-bg)',
        'syntax-removed-text': 'var(--syntax-removed-text)',
        'syntax-removed-border': 'var(--syntax-removed-border)',
        'syntax-neutral': 'var(--syntax-neutral)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'glow': '0 0 15px rgba(59, 130, 246, 0.5)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}