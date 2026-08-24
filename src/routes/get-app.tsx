import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Download,
  EllipsisVertical,
  Plus,
  Share,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import {
  canPromptInstall,
  initPwa,
  isAndroid,
  isIos,
  isNativeShell,
  isStandalone,
  promptInstall,
  subscribePwa,
} from "@/lib/pwa";
import { useSettings } from "@/stores/settings";

export const Route = createFileRoute("/get-app")({ component: GetAppPage });

function GetAppPage() {
  const lang = useSettings((s) => s.lang);
  const [ready, setReady] = useState(false);
  const [promptable, setPromptable] = useState(false);
  const [hasApk, setHasApk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    initPwa();
    setReady(true);
    setPromptable(canPromptInstall());
    return subscribePwa(() => setPromptable(canPromptInstall()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/native/HasiScan.apk", { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setHasApk(res.ok);
      })
      .catch(() => {
        if (!cancelled) setHasApk(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const installed = ready && (isStandalone() || isNativeShell());
  const ios = ready && isIos();
  const android = ready && isAndroid();

  const install = async () => {
    setBusy(true);
    try {
      const ok = await promptInstall();
      if (ok) toast.success(t(lang, "getAppInstalled"));
    } catch {
      toast.error(t(lang, "somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
      <header className="flex flex-col items-start gap-4">
        <img
          src="/icons/icon-192.png"
          alt=""
          width={72}
          height={72}
          className="size-16 rounded-2xl ring-1 ring-border"
        />
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-widest text-accent uppercase">
            Hasi Elektronic
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {t(lang, "getAppTitle")}
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            {t(lang, "getAppLead")}
          </p>
        </div>
      </header>

      {installed ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-5 ring-1 ring-border">
          <Check className="size-5 text-accent" />
          <p className="text-sm font-medium">{t(lang, "getAppInstalled")}</p>
        </div>
      ) : (
        <>
          {promptable && (
            <Button className="w-full" disabled={busy} onClick={() => void install()}>
              <Download className="size-4" />
              {t(lang, "getAppInstall")}
            </Button>
          )}

          <section className="space-y-3">
            <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
              {t(lang, "getAppIos")}
            </h2>
            <ol className="overflow-hidden rounded-2xl ring-1 ring-border">
              <Step n={1} icon={Share} active={ios}>
                {t(lang, "getAppIosStep1")}
              </Step>
              <Step n={2} icon={Plus} active={ios}>
                {t(lang, "getAppIosStep2")}
              </Step>
              <Step n={3} icon={Check} active={ios}>
                {t(lang, "getAppIosStep3")}
              </Step>
            </ol>
            <p className="text-xs text-faint">{t(lang, "getAppSafari")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
              {t(lang, "getAppAndroid")}
            </h2>
            <ol className="overflow-hidden rounded-2xl ring-1 ring-border">
              <Step n={1} icon={EllipsisVertical} active={android}>
                {t(lang, "getAppAndroidStep1")}
              </Step>
              <Step n={2} icon={Smartphone} active={android}>
                {t(lang, "getAppAndroidStep2")}
              </Step>
            </ol>
            {hasApk && (
              <a
                href="/native/HasiScan.apk"
                download="HasiScan-1.0.0.apk"
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-surface text-sm font-medium ring-1 ring-border"
              >
                <Download className="size-4" />
                {t(lang, "getAppApk")}
              </a>
            )}
            {hasApk && (
              <p className="text-xs text-faint">{t(lang, "getAppApkHint")}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Step({
  n,
  icon: Icon,
  active,
  children,
}: {
  n: number;
  icon: typeof Share;
  active: boolean;
  children: string;
}) {
  return (
    <li
      className={cn(
        "flex items-start gap-3 px-4 py-4",
        n > 1 && "border-t border-border",
        active ? "bg-surface" : "bg-bg",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">
        {n}
      </span>
      <p className="min-w-0 flex-1 pt-1.5 text-sm leading-relaxed">{children}</p>
      <Icon className="mt-2 size-4 shrink-0 text-muted" />
    </li>
  );
}
