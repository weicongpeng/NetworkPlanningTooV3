import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'dark' | 'light'
export type ColorScheme = 'blue' | 'green' | 'purple' | 'orange' | 'pink'

export interface ThemeColors {
  primary: string
  primaryForeground: string
}

export const THEME_COLORS: Record<ColorScheme, ThemeColors> = {
  blue: {
    primary: '207 90% 54%',
    primaryForeground: '0 0% 100%'
  },
  green: {
    primary: '142.1 76.2% 36.3%',
    primaryForeground: '355.7 100% 97.3%'
  },
  purple: {
    primary: '262.1 83.3% 57.8%',
    primaryForeground: '210 40% 98%'
  },
  orange: {
    primary: '24.6 95% 53.1%',
    primaryForeground: '60 9.1% 97.8%'
  },
  pink: {
    primary: '330 81% 60%',
    primaryForeground: '210 40% 98%'
  }
}

export const DARK_THEME_VARS = {
  background: '222.2 84% 4.9%',
  foreground: '210 40% 98%',
  card: '222.2 84% 4.9%',
  cardForeground: '210 40% 98%',
  popover: '222.2 84% 4.9%',
  popoverForeground: '210 40% 98%',
  secondary: '217.2 32.6% 17.5%',
  secondaryForeground: '210 40% 98%',
  muted: '217.2 32.6% 17.5%',
  mutedForeground: '215 20.2% 65.1%',
  accent: '217.2 32.6% 17.5%',
  accentForeground: '210 40% 98%',
  destructive: '0 62.8% 30.6%',
  destructiveForeground: '210 40% 98%',
  border: '217.2 32.6% 17.5%',
  input: '217.2 32.6% 17.5%',
  ring: '224.3 76.3% 48%'
}

export const LIGHT_THEME_VARS = {
  background: '0 0% 100%',
  foreground: '222.2 84% 4.9%',
  card: '0 0% 100%',
  cardForeground: '222.2 84% 4.9%',
  popover: '0 0% 100%',
  popoverForeground: '222.2 84% 4.9%',
  secondary: '210 40% 96.1%',
  secondaryForeground: '222.2 47.4% 11.2%',
  muted: '210 40% 96.1%',
  mutedForeground: '215.4 16.3% 46.9%',
  accent: '210 40% 96.1%',
  accentForeground: '222.2 47.4% 11.2%',
  destructive: '0 84.2% 60.2%',
  destructiveForeground: '210 40% 98%',
  border: '214.3 31.8% 91.4%',
  input: '214.3 31.8% 91.4%',
  ring: '221.2 83.2% 53.3%'
}

interface ThemeState {
  themeMode: ThemeMode
  colorScheme: ColorScheme
  setThemeMode: (mode: ThemeMode) => void
  setColorScheme: (scheme: ColorScheme) => void
  applyTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeMode: 'dark',
      colorScheme: 'blue',

      setThemeMode: (mode: ThemeMode) => {
        set({ themeMode: mode })
        get().applyTheme()
      },

      setColorScheme: (scheme: ColorScheme) => {
        set({ colorScheme: scheme })
        get().applyTheme()
      },

      applyTheme: () => {
        try {
          const { themeMode, colorScheme } = get()
          const root = document.documentElement

          // Apply theme mode variables
          const themeVars = themeMode === 'dark' ? DARK_THEME_VARS : LIGHT_THEME_VARS
          Object.entries(themeVars).forEach(([key, value]) => {
            root.style.setProperty(`--${key}`, value)
          })

          // Apply color scheme variables
          const colorVars = THEME_COLORS[colorScheme]
          Object.entries(colorVars).forEach(([key, value]) => {
            root.style.setProperty(`--${kebabCase(key)}`, value)
          })
        } catch (error) {
          console.error('Failed to apply theme:', error)
        }
      }
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        state?.applyTheme()
      }
    }
  )
)

export function kebabCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
