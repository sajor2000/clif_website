/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'clif-burgundy': '#8B1538',
        'clif-burgundy-dark': '#6B1028',
        'clif-burgundy-light': '#A62048',
        'clif-white': '#ffffff',
        'clif-gray': {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          600: '#475569',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      fontFamily: {
        heading: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'xs': '0.75rem',     /* 12px */
        'sm': '0.875rem',    /* 14px */
        'base': '1rem',      /* 16px */
        'lg': '1.125rem',    /* 18px */
        'xl': '1.25rem',     /* 20px */
        '2xl': '1.5rem',     /* 24px */
        '3xl': '1.875rem',   /* 30px */
        '4xl': '2.25rem',    /* 36px */
        '5xl': '3rem',       /* 48px */
      },
    },
  },
  plugins: [],
}
