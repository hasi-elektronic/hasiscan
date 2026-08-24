import { useEffect, type ReactNode } from "react";
import { initPwa } from "@/lib/pwa";
import { useSettings } from "@/stores/settings";
import { useLibrary } from "@/stores/library";

function resolvedDark(theme: "system" | "light" | "dark") {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSettings((s) => s.theme);
  const lang = useSettings((s) => s.lang);
  const hydrate = useLibrary((s) => s.hydrate);

  useEffect(() => {
    initPwa();
    void useSettings.persist.rehydrate();
  }, []);

  useEffect(() => {
    void hydrate(lang);
  }, [hydrate, lang]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = resolvedDark(theme);
      root.classList.toggle("dark", dark);
      root.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    root.lang = lang;
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, lang]);

  return children;
}

export function useIsDark() {
  const theme = useSettings((s) => s.theme);
  return resolvedDark(theme);
}
