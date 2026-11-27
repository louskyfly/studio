/**
 * Thèmes graphiques des présentations.
 *
 * Les polices sont volontairement choisies parmi celles présentes sur
 * Windows, macOS et iPadOS : le rendu du PPTX exporté reste fidèle.
 */

export interface Theme {
  id: string
  name: string
  /** Qualificatif court affiché dans le sélecteur. */
  mood: string
  bg: string
  bgAlt: string
  surface: string
  ink: string
  muted: string
  accent: string
  accentSoft: string
  accent2: string
  line: string
  headingFont: string
  bodyFont: string
  dark?: boolean
  palette: string[]
}

export const THEMES: Theme[] = [
  {
    id: 'ivoire',
    name: 'Ivoire',
    mood: 'Chaleureux, intemporel',
    bg: '#FBFAF7',
    bgAlt: '#F1EEE7',
    surface: '#FFFFFF',
    ink: '#16243A',
    muted: '#6D7480',
    accent: '#1F3A5F',
    accentSoft: '#E7EDF5',
    accent2: '#B08A4A',
    line: '#E3DFD5',
    headingFont: 'Georgia',
    bodyFont: 'Segoe UI',
    palette: ['#1F3A5F', '#B08A4A', '#6D8AA8', '#8C6A5D', '#4F6B5D', '#A9A29A'],
  },
  {
    id: 'encre',
    name: 'Encre',
    mood: 'Épuré, éditorial',
    bg: '#FFFFFF',
    bgAlt: '#F4F4F2',
    surface: '#FFFFFF',
    ink: '#14161A',
    muted: '#70747A',
    accent: '#14161A',
    accentSoft: '#EFEFEC',
    accent2: '#B4553B',
    line: '#E2E1DD',
    headingFont: 'Georgia',
    bodyFont: 'Helvetica Neue',
    palette: ['#14161A', '#B4553B', '#7C8B99', '#9C8F7A', '#5B6B57', '#B9B4AC'],
  },
  {
    id: 'ardoise',
    name: 'Ardoise',
    mood: 'Sobre, institutionnel',
    bg: '#F5F7F9',
    bgAlt: '#E9EEF3',
    surface: '#FFFFFF',
    ink: '#1B2430',
    muted: '#66707C',
    accent: '#2C4A6E',
    accentSoft: '#E2EAF3',
    accent2: '#7A93AD',
    line: '#DBE1E8',
    headingFont: 'Palatino Linotype',
    bodyFont: 'Segoe UI',
    palette: ['#2C4A6E', '#7A93AD', '#4E6E5C', '#A5715F', '#8A7BA0', '#9AA4AE'],
  },
  {
    id: 'parchemin',
    name: 'Parchemin',
    mood: 'Histoire, archives',
    bg: '#F8F3E9',
    bgAlt: '#EFE7D8',
    surface: '#FFFCF6',
    ink: '#3A2E23',
    muted: '#7B6C5B',
    accent: '#7A5C3A',
    accentSoft: '#EFE5D3',
    accent2: '#4F6B5D',
    line: '#E0D5C2',
    headingFont: 'Georgia',
    bodyFont: 'Segoe UI',
    palette: ['#7A5C3A', '#4F6B5D', '#A5715F', '#8A7BA0', '#C2A878', '#7B6C5B'],
  },
  {
    id: 'atlas',
    name: 'Atlas',
    mood: 'Géographie, cartes',
    bg: '#F6F9F7',
    bgAlt: '#E8F0EB',
    surface: '#FFFFFF',
    ink: '#17281F',
    muted: '#5F6F66',
    accent: '#1F5C43',
    accentSoft: '#E1EDE6',
    accent2: '#3C7EA8',
    line: '#D8E4DC',
    headingFont: 'Georgia',
    bodyFont: 'Segoe UI',
    palette: ['#1F5C43', '#3C7EA8', '#B08A4A', '#8C6A5D', '#5D6B8A', '#7D8B82'],
  },
  {
    id: 'nuit',
    name: 'Nuit',
    mood: 'Projection, contraste',
    bg: '#12161B',
    bgAlt: '#1A2027',
    surface: '#1E242C',
    ink: '#F3F1EC',
    muted: '#A2ABB5',
    accent: '#C9A961',
    accentSoft: '#2A3138',
    accent2: '#7FA6C9',
    line: '#2E3640',
    headingFont: 'Georgia',
    bodyFont: 'Segoe UI',
    dark: true,
    palette: ['#C9A961', '#7FA6C9', '#9DB39C', '#C98F7F', '#A99BC4', '#8E99A4'],
  },
]

export const themeById = (id: string): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0]

/** Pile de polices web équivalente aux polices des thèmes. */
export const fontStack = (font: string): string => {
  const map: Record<string, string> = {
    Georgia: 'Georgia, "Times New Roman", serif',
    'Palatino Linotype': '"Palatino Linotype", "Book Antiqua", Palatino, serif',
    'Helvetica Neue': '"Helvetica Neue", Helvetica, Arial, sans-serif',
    'Segoe UI': '"Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
    Cambria: 'Cambria, Georgia, serif',
    Calibri: 'Calibri, "Segoe UI", sans-serif',
  }
  return map[font] ?? `"${font}", sans-serif`
}

export const FONT_CHOICES = [
  'Georgia',
  'Palatino Linotype',
  'Cambria',
  'Segoe UI',
  'Helvetica Neue',
  'Calibri',
  'Trebuchet MS',
  'Arial',
]
