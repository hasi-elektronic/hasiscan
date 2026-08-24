import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "@/lib/i18n";

export type ThemeMode = "system" | "light" | "dark";

interface SettingsState {
  lang: Lang;
  theme: ThemeMode;
  autoMagic: boolean;
  setLang: (lang: Lang) => void;
  setTheme: (theme: ThemeMode) => void;
  setAutoMagic: (v: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: "tr",
      theme: "dark",
      autoMagic: true,
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      setAutoMagic: (autoMagic) => set({ autoMagic }),
    }),
    { name: "hasiscan-settings", skipHydration: true },
  ),
);
