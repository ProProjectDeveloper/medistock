import { useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'medistock.theme';

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(read);
  useEffect(() => {
    const root = document.documentElement;
    if (pref === 'system') delete root.dataset.theme; else root.dataset.theme = pref;
    try { if (pref === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref); } catch { /* ignore */ }
  }, [pref]);
  return [pref, setPref] as const;
}

export function isDark(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t) return t === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
