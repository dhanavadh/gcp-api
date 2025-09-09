/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['IBM Plex Sans Thai', 'sans-serif'],
        'thai': ['IBM Plex Sans Thai', 'sans-serif'],
        'mono': ['IBM Plex Mono', 'monospace', 'IBM Plex Sans Thai', 'sans-serif'],
      },
    },
  },
  plugins: [],
};