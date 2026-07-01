/** @type {import('tailwindcss').Config} */
export default {
  content: ['./resources/js/**/*.{js,ts,jsx,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf5',
          100: '#d8f3e4',
          500: '#19a974',
          600: '#11805a',
          700: '#0e684a',
        },
      },
    },
  },
  plugins: [],
}
