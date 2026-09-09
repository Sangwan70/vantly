// Named color-theme presets for the Mailer Template designer's "Apply
// Theme" toolbar action. Deliberately narrow in scope: applying a theme
// only rewrites the *accent* colors used by Button/Divider/Quote/Social/
// Stats blocks -- see mutations.ts's applyTheme() doc comment.

export interface ThemePreset {
  id: string;
  name: string;
  /** Button background, quote/stats accent, social badge background. */
  accent: string;
  /** Divider line color -- deliberately more muted than the accent. */
  divider: string;
  /** Button label color -- always high-contrast against `accent`. */
  onAccent: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'brand',
    name: 'Brand (violet)',
    accent: '#6E57F6',
    divider: 'rgba(110,87,246,0.35)',
    onAccent: '#FFFFFF',
  },
  {
    id: 'blue',
    name: 'Blue',
    accent: '#2563EB',
    divider: 'rgba(37,99,235,0.35)',
    onAccent: '#FFFFFF',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    accent: '#059669',
    divider: 'rgba(5,150,105,0.35)',
    onAccent: '#FFFFFF',
  },
  {
    id: 'grey',
    name: 'Grey / Neutral',
    accent: '#4B5563',
    divider: 'rgba(0,0,0,0.12)',
    onAccent: '#FFFFFF',
  },
];

export function findThemePreset(id: string): ThemePreset | null {
  return THEME_PRESETS.find((t) => t.id === id) || null;
}
