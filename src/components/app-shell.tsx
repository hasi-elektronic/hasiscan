import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Files, House, QrCode, ScanLine, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { t, type MsgKey } from "@/lib/i18n";
import { useSettings } from "@/stores/settings";

const NAV: { to: string; icon: typeof House; key: MsgKey }[] = [
  { to: "/", icon: House, key: "home" },
  { to: "/scan", icon: ScanLine, key: "scanDoc" },
  { to: "/qr", icon: QrCode, key: "scanQr" },
  { to: "/library", icon: Files, key: "library" },
  { to: "/settings", icon: Settings, key: "settings" },
];

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  if (to === "/library") {
    return pathname === "/library" || pathname.startsWith("/folder");
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const lang = useSettings((s) => s.lang);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const immersive = pathname.startsWith("/scan") || pathname.startsWith("/qr");

  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="px-5 pt-6 pb-4">
          <Link to="/" className="font-display text-lg font-semibold tracking-tight">
            Hasi<span className="text-accent">Scan</span>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-accent/12 text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
                {t(lang, item.key)}
              </Link>
            );
          })}
        </nav>
        <p className="px-5 py-4 text-xs text-faint">{t(lang, "version")}</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            immersive
              ? "p-0"
              : "px-4 pt-5 pad-nav md:px-8 md:pt-8 md:pb-8",
          )}
        >
          {children}
        </main>

        {!immersive && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/92 backdrop-blur-md md:hidden pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium",
                    active ? "text-accent" : "text-muted",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.1 : 1.7} />
                  <span className="max-w-14 truncate">{t(lang, item.key)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
        )}
      </div>
    </div>
  );
}
