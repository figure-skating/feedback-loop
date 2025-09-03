/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        iphone: "390px",
        ipad: "768px",
        desktop: "1024px",
      },
      height: {
        iphone: "844px",
        ipad: "1024px",
      },
      maxWidth: {
        iphone: "390px",
        ipad: "768px",
      },
      colors: {
        'ice-blue': {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#87ceeb',
          400: '#5dade2',
          500: '#3498db',
          600: '#2980b9',
          700: '#2c5aa0',
          800: '#1e3a8a',
          900: '#1e3a8a',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

