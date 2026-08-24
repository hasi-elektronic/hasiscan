import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, ImagePlus, RefreshCcw, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { fileToFittedDataUrl } from "@/lib/image-process";
import { t, type MsgKey } from "@/lib/i18n";
import { useSettings } from "@/stores/settings";

interface CameraStageProps {
  onCapture: (dataUrl: string) => void;
  live?: boolean;
  onFrame?: (canvas: HTMLCanvasElement) => void;
  overlay?: ReactNode;
  className?: string;
}

export function CameraStage({
  onCapture,
  live = false,
  onFrame,
  overlay,
  className,
}: CameraStageProps) {
  const lang = useSettings((s) => s.lang);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const facingRef = useRef<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const tr = (key: MsgKey) => t(lang, key);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
    setTorchOn(false);
  }, []);

  const start = useCallback(async () => {
    stop();
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(tr("cameraMissing"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingRef.current },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
        setReady(true);
      }
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as
        | { torch?: boolean }
        | undefined;
      setTorchAvailable(Boolean(caps?.torch));
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotAllowedError" ? tr("cameraDenied") : tr("cameraMissing"),
      );
    }
  }, [stop, lang]);

  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  useEffect(() => {
    if (!live || !ready || !onFrame) return;
    let last = 0;
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (now - last < 120) return;
      last = now;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      const scale = Math.min(1, 640 / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      onFrame(canvas);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [live, ready, onFrame]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) return;
    const dataUrl = await fileToFittedDataUrl(blob);
    onCapture(dataUrl);
  }, [onCapture]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await fileToFittedDataUrl(file);
    onCapture(dataUrl);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as MediaTrackConstraintSet],
      });
      setTorchOn((v) => !v);
    } catch {
      setTorchAvailable(false);
    }
  };

  const switchCam = () => {
    facingRef.current =
      facingRef.current === "environment" ? "user" : "environment";
    void start();
  };

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-ink",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void onFile(e.dataTransfer.files[0]);
      }}
    >
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 size-full object-cover",
          ready ? "opacity-100" : "opacity-0",
        )}
        playsInline
        muted
        autoPlay
      />
      <canvas ref={canvasRef} className="hidden" />

      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-full border border-border bg-surface">
            <Camera className="size-6 text-muted" />
          </div>
          <p className="max-w-xs text-sm text-muted">
            {error ?? tr("noCameraUseUpload")}
          </p>
          {error && (
            <Button size="sm" variant="secondary" onClick={() => void start()}>
              {tr("retry")}
            </Button>
          )}
        </div>
      )}

      {overlay}

      <div className="pointer-events-none absolute inset-0 scan-vignette" />

      {dragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/70 text-sm font-medium">
          {tr("dropHint")}
        </div>
      )}

      <div className="relative z-10 mt-auto flex items-center justify-between gap-3 p-4">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label={tr("gallery")}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="size-5" />
        </Button>

        {live ? (
          <p className="text-xs font-medium tracking-wide text-paper/80 uppercase">
            {tr("holdSteady")}
          </p>
        ) : (
          <button
            type="button"
            aria-label={tr("capture")}
            onClick={() => void capture()}
            disabled={!ready}
            className="shutter"
          >
            <span className="shutter-inner" />
          </button>
        )}

        <div className="flex gap-2">
          {torchAvailable && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label={tr("torch")}
              onClick={() => void toggleTorch()}
            >
              {torchOn ? (
                <Zap className="size-5" />
              ) : (
                <ZapOff className="size-5" />
              )}
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label={tr("switchCamera")}
            onClick={switchCam}
          >
            <RefreshCcw className="size-5" />
          </Button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
