import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Wired to CSS variables (see globals.css) instead of fixed hex
        // values — this is what makes dark mode apply across every existing
        // page automatically, since every bg-ink/bg-paper/bg-mist/bg-white
        // class already in use throughout the app reads from these same
        // variables rather than a hardcoded color.
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        mist: 'rgb(var(--color-mist) / <alpha-value>)',
        // Dedicated token for "card/panel background" — NOT an override of
        // Tailwind's built-in white. An earlier version of this did override
        // white directly, which seemed convenient since bg-white was always
        // used to mean "card surface" throughout this app — but it also
        // broke every text-white button label (white text on a colored
        // button) by making it dark-on-dark in dark mode, since both classes
        // share the same underlying color key. surface is separate on
        // purpose so text-white always stays actually white.
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        indigo: {
          DEFAULT: '#3730A9',
          50: '#EEF0FC',
          100: '#DCE0F8',
          400: '#5B54C4',
          500: '#3730A9',
          600: '#2B2585',
          700: '#201B61',
        },
        saffron: {
          DEFAULT: '#E28A2B',
          light: '#F5C77E',
        },
        leaf: {
          DEFAULT: '#1F8A5F',
          light: '#D6F0E3',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(20, 23, 31, 0.06)',
      },
    },
  },
  plugins: [],
};
export default config;
