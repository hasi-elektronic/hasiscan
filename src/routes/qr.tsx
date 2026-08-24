import { useCallback, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, QrCode, Wifi } from "lucide-react";
import { toast } from "sonner";
import { CameraStage } from "@/components/scanner/camera-stage";
import { Button } from "@/components/ui/button";
import { loadImage } from "@/lib/image-process";
import { t } from "@/lib/i18n";
import {
  beep,
  classifyQr,
  detectFromCanvas,
  hrefFor,
  parseWifi,
  type QrHit,
} from "@/lib/qr";
import { useLibrary } from "@/stores/library";
import { useSettings } from "@/stores/settings";

export const Route = createFileRoute("/qr")({
  ssr: false,
  component: QrPage,
});

function QrPage() {
  const lang = useSettings((s) => s.lang);
  const saveQr = useLibrary((s) => s.saveQr);
  const [hit, setHit] = useState<QrHit | null>(null);
  const locked = useRef(false);

  const onFrame = useCallback(async (canvas: HTMLCanvasElement) => {
    if (locked.current) return;
    const found = await detectFromCanvas(canvas);
    if (!found) return;
    locked.current = true;
    beep();
    setHit(found);
  }, []);

  const onStill = useCallback(async (dataUrl: string) => {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const found = await detectFromCanvas(canvas);
    if (!found) {
      toast.error(t(lang, "ocrEmpty"));
      return;
    }
    locked.current = true;
    beep();
    setHit(found);
  }, [lang]);

  const reset = () => {
    locked.current = false;
    setHit(null);
  };

  const kind = hit ? classifyQr(hit.value) : "text";
  const href = hit ? hrefFor(hit.value) : null;
  const wifi = hit && kind === "wifi" ? parseWifi(hit.value) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-bg md:min-h-0 md:flex-1">
      <header className="px-4 py-3 text-center md:px-2">
        <p className="text-sm font-medium">{t(lang, "scanQr")}</p>
        <p className="text-xs text-muted">{t(lang, "pointAtQr")}</p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 md:px-2 md:pb-2">
        <CameraStage
          live
          onCapture={(dataUrl) => void onStill(dataUrl)}
          onFrame={onFrame}
          overlay={
            <div className="finder" aria-hidden="true">
              <span />
            </div>
          }
        />
      </div>

      {hit && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pad-nav md:bottom-6 md:left-auto md:right-8 md:w-96 md:px-0 md:pb-0">
          <div className="rounded-2xl bg-surface p-5 shadow-lg ring-1 ring-border">
            <div className="mb-3 flex items-center gap-2 text-accent">
              {kind === "wifi" ? (
                <Wifi className="size-4" />
              ) : (
                <QrCode className="size-4" />
              )}
              <p className="text-xs font-medium tracking-wide uppercase">
                {t(lang, "qrFound")} · {hit.format.replace("_", " ")}
              </p>
            </div>
            {wifi ? (
              <div className="space-y-1">
                <p className="font-medium">{wifi.ssid}</p>
                <p className="font-mono text-sm text-muted">{wifi.pass}</p>
              </div>
            ) : (
              <p className="break-all text-sm leading-relaxed">{hit.value}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {href && (
                <Button size="sm" asChild>
                  <a href={href} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />
                    {t(lang, "openLink")}
                  </a>
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(hit.value);
                  toast.success(t(lang, "copied"));
                }}
              >
                <Copy className="size-3.5" />
                {t(lang, "copy")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await saveQr(hit.value);
                  toast.success(t(lang, "saved"));
                }}
              >
                <Check className="size-3.5" />
                {t(lang, "saveQr")}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>
                {t(lang, "retry")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
