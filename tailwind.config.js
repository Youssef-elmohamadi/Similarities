/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAF7F0',
        surface: '#FFFFFF',
        border: '#E8E2D4',
        
        primary: {
          DEFAULT: '#0F5C4A',
          hover: '#0B4738',
          tint: '#E6F2EE',
          50: '#E6F2EE',
          100: '#CBE5DE',
          200: '#9BCBBF',
          300: '#69B09F',
          400: '#3A9580',
          500: '#0F5C4A',
          600: '#0B4738',
          700: '#08382C',
          800: '#05271F',
          900: '#021611',
        },
        
        accent: {
          DEFAULT: '#B8924A',
          tint: '#F6EEDC',
          50: '#F6EEDC',
          100: '#ECDDBD',
          200: '#DEBF83',
          300: '#D0A149',
          400: '#B8924A',
          500: '#9E7A35',
          600: '#7E6128',
          700: '#5F491E',
          800: '#403113',
          900: '#21190A',
        },

        'text-primary': '#1F2937',
        'text-secondary': '#5B6472',

        danger: {
          DEFAULT: '#B42318',
          subtle: '#FEE4E2',
        },
        success: {
          DEFAULT: '#107C41',
          subtle: '#DCFAE6',
        },
        warning: {
          DEFAULT: '#B54708',
          subtle: '#FEF0C7',
        },

        // Legacy compatibility mappings
        emerald: {
          50: '#E6F2EE',
          100: '#CBE5DE',
          200: '#9BCBBF',
          300: '#69B09F',
          400: '#3A9580',
          500: '#0F5C4A',
          600: '#0B4738',
          700: '#08382C',
          800: '#0F5C4A',
          900: '#0B4738',
        },
        gold: {
          50: '#F6EEDC',
          100: '#ECDDBD',
          200: '#DEBF83',
          300: '#D0A149',
          400: '#B8924A',
          500: '#9E7A35',
          600: '#7E6128',
          700: '#5F491E',
          800: '#403113',
          900: '#21190A',
        },
        charcoal: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#5B6472',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        }
      },
      fontFamily: {
        ui: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        quran: ['"Amiri Quran"', '"Amiri"', '"Noto Naskh Arabic"', 'serif'],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
      },
      maxWidth: {
        '6xl': '72rem',
      }
    },
  },
  plugins: [],
}
