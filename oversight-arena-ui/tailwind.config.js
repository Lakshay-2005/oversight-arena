/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Static approximations of the CSS-var ramp (themed values live in globals.css).
        bg: '#0B0C0E',
        card: '#121317',
        border: '#1E2026',
        worker: '#E8A84A',
        overseer: '#5B93F5',
        reward: '#4EC98A',
        danger: '#E8655A',
        muted: '#7E838E',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
