import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Monitor, Moon, Smartphone, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { LANGS, t } from "@/lib/i18n";
import { useLibrary } from "@/stores/library";
import { useSettings, type ThemeMode } from "@/stores/settings";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const THEMES: { id: ThemeMode; icon: typeof Moon; key: "themeSystem" | "themeLight" | "themeDark" }[] =
  [
    { id: "system", icon: Monitor, key: "themeSystem" },
    { id: "light", icon: Sun, key: "themeLight" },
    { id: "dark", icon: Moon, key: "themeDark" },
  ];

function SettingsPage() {
  const lang = useSettings((s) => s.lang);
  const theme = useSettings((s) => s.theme);
  const autoMagic = useSettings((s) => s.autoMagic);
  const setLang = useSettings((s) => s.setLang);
  const setTheme = useSettings((s) => s.setTheme);
  const setAutoMagic = useSettings((s) => s.setAutoMagic);
  const wipe = useLibrary((s) => s.wipe);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {t(lang, "settings")}
        </h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
          {t(lang, "appearance")}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((item) => {
            const Icon = item.icon;
            const active = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                className={cn(
                  "flex h-20 flex-col items-center justify-center gap-2 rounded-2xl text-sm font-medium ring-1 transition-colors duration-150",
                  active
                    ? "bg-accent text-accent-fg ring-accent"
                    : "bg-surface text-fg ring-border hover:bg-surface-2",
                )}
              >
                <Icon className="size-4" />
                {t(lang, item.key)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
          {t(lang, "language")}
        </h2>
        <div className="flex flex-col overflow-hidden rounded-2xl ring-1 ring-border">
          {LANGS.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLang(item.id)}
              className={cn(
                "flex h-12 items-center justify-between px-4 text-sm",
                i > 0 && "border-t border-border",
                lang === item.id ? "bg-surface font-medium" : "bg-bg",
              )}
            >
              <span>{item.label}</span>
              {lang === item.id && <Check className="size-4 text-accent" />}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
          {t(lang, "enhance")}
        </h2>
        <button
          type="button"
          onClick={() => setAutoMagic(!autoMagic)}
          className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-4 text-left ring-1 ring-border"
        >
          <span>
            <span className="block text-sm font-medium">{t(lang, "autoMagic")}</span>
            <span className="mt-0.5 block text-xs text-muted">
              {t(lang, "autoMagicHint")}
            </span>
          </span>
          <span
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors duration-150",
              autoMagic ? "bg-accent" : "bg-surface-2",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 size-5 rounded-full bg-paper transition-transform duration-150",
                autoMagic && "translate-x-5",
              )}
            />
          </span>
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
          {t(lang, "getApp")}
        </h2>
        <Link
          to="/get-app"
          className="flex h-14 items-center justify-between rounded-2xl bg-surface px-4 text-sm font-medium ring-1 ring-border"
        >
          <span className="inline-flex items-center gap-3">
            <Smartphone className="size-4 text-accent" />
            {t(lang, "getAppTitle")}
          </span>
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
          {t(lang, "about")}
        </h2>
        <div className="rounded-2xl bg-surface p-5 text-sm leading-relaxed text-muted ring-1 ring-border">
          <p className="font-medium text-fg">Hasi Elektronic</p>
          <p className="mt-2">{t(lang, "aboutBody")}</p>
          <p className="mt-3 text-xs text-faint">
            Grabenstraße 18, 71665 Vaihingen/Enz
          </p>
          <p className="text-xs text-faint">{t(lang, "version")}</p>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            if (!confirm(t(lang, "deleteConfirm"))) return;
            await wipe(lang);
            toast.success(t(lang, "saved"));
          }}
        >
          {t(lang, "clearLibrary")}
        </Button>
        <p className="text-xs text-faint">{t(lang, "clearLibraryHint")}</p>
      </section>
    </div>
  );
}
