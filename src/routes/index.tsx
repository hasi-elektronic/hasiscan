import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileText, QrCode, ScanLine, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { useLibrary } from "@/stores/library";
import { useSettings } from "@/stores/settings";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const lang = useSettings((s) => s.lang);
  const docs = useLibrary((s) => s.docs);
  const ready = useLibrary((s) => s.ready);
  const recents = docs.slice(0, 8);
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="rise space-y-3">
        <p className="text-xs font-medium tracking-widest text-accent uppercase">
          Hasi Elektronic
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
          HasiScan
        </h1>
        <p className="max-w-md text-base leading-relaxed text-muted">
          {t(lang, "tagline")}
        </p>
        <Link
          to="/get-app"
          className="inline-flex items-center gap-2 text-sm font-medium text-accent"
        >
          <Smartphone className="size-4" />
          {t(lang, "getApp")}
        </Link>
      </header>

      <div className="rise-2 grid gap-3 sm:grid-cols-2">
        <Link
          to="/scan"
          className="group flex min-h-36 flex-col justify-between rounded-2xl bg-surface p-5 ring-1 ring-border transition-transform duration-150 active:scale-[0.96]"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-accent/12 text-accent">
            <ScanLine className="size-5" />
          </span>
          <span>
            <span className="block text-lg font-semibold">{t(lang, "scanDoc")}</span>
            <span className="mt-1 block text-sm text-muted">
              {t(lang, "scanDocHint")}
            </span>
          </span>
        </Link>
        <Link
          to="/qr"
          className="group flex min-h-36 flex-col justify-between rounded-2xl bg-surface p-5 ring-1 ring-border transition-transform duration-150 active:scale-[0.96]"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-surface-2 text-fg">
            <QrCode className="size-5" />
          </span>
          <span>
            <span className="block text-lg font-semibold">{t(lang, "scanQr")}</span>
            <span className="mt-1 block text-sm text-muted">
              {t(lang, "scanQrHint")}
            </span>
          </span>
        </Link>
      </div>

      <div className="rise-3 overflow-hidden rounded-2xl md:max-h-56">
        <img
          src="/art/empty-desk.jpg"
          alt=""
          className="aspect-hero w-full object-cover md:max-h-56"
        />
      </div>

      <section className="rise-4 space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-medium tracking-wide text-muted uppercase">
            {t(lang, "recents")}
          </h2>
          {docs.length > 0 && (
            <Link
              to="/library"
              className="inline-flex items-center gap-1 text-sm font-medium text-accent"
            >
              {t(lang, "seeAll")}
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>

        {!ready ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-page animate-pulse rounded-2xl bg-surface"
              />
            ))}
          </div>
        ) : recents.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-2xl bg-surface p-6 ring-1 ring-border">
            <FileText className="size-6 text-muted" />
            <div>
              <p className="font-medium">{t(lang, "emptyLibrary")}</p>
              <p className="mt-1 text-sm text-muted">
                {t(lang, "emptyLibraryHint")}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void navigate({ to: "/scan", search: { sample: true } })
              }
            >
              {t(lang, "trySample")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {recents.map((doc) => (
              <Link
                key={doc.id}
                to="/doc/$id"
                params={{ id: doc.id }}
                className="group overflow-hidden rounded-2xl bg-surface ring-1 ring-border transition-transform duration-150 active:scale-[0.96]"
              >
                <div className="aspect-page bg-surface-2">
                  {doc.thumb ? (
                    <img
                      src={doc.thumb}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <QrCode className="size-8 text-muted" />
                    </div>
                  )}
                </div>
                <div className="space-y-0.5 p-3">
                  <p className="truncate text-sm font-medium">{doc.title}</p>
                  <p className="text-xs text-faint">
                    {formatWhen(doc.updatedAt, lang)}
                    {doc.type === "document"
                      ? ` · ${doc.pageIds.length}`
                      : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
