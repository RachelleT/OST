export interface Palette {
  bg: string
  surface: string
  accent: string
  textOnBg: string
  // Lighter shade used for soft shapes
  light: string
  // Slightly darker shade used for bold shapes
  dark: string
  dayName: string
}

const PALETTES: Record<number, Palette> = {
  1: { dayName: 'Monday',    bg: '#2DBFA8', surface: '#E1F5EE', accent: '#04342C', textOnBg: '#04342C', light: '#7FDDCB', dark: '#1D9E75' },
  2: { dayName: 'Tuesday',   bg: '#FF7A59', surface: '#FFE0D4', accent: '#4A1B0C', textOnBg: '#4A1B0C', light: '#FFB59C', dark: '#D95A38' },
  3: { dayName: 'Wednesday', bg: '#4D96FF', surface: '#E6F1FB', accent: '#042C53', textOnBg: '#042C53', light: '#9EC9FF', dark: '#2B6FCC' },
  4: { dayName: 'Thursday',  bg: '#FF5C8A', surface: '#FFE6EE', accent: '#4B1528', textOnBg: '#4B1528', light: '#FFB3CC', dark: '#D93D6B' },
  5: { dayName: 'Friday',    bg: '#6FCF4D', surface: '#EAF3DE', accent: '#173404', textOnBg: '#173404', light: '#B4E89A', dark: '#4BA82A' },
  6: { dayName: 'Saturday',  bg: '#9B7EDC', surface: '#EEEDFE', accent: '#26215C', textOnBg: '#26215C', light: '#CFC4F5', dark: '#7257B8' },
  0: { dayName: 'Sunday',    bg: '#F4C77B', surface: '#F9E0AE', accent: '#412402', textOnBg: '#412402', light: '#FAE0A8', dark: '#D9972A' },
}

/** Returns the colour palette for the given date's day of week. */
export function dayPalette(date: Date): Palette {
  const dow = date.getDay() // 0 = Sunday … 6 = Saturday
  return PALETTES[dow]
}
