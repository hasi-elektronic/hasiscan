import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Check, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cropDataUrl,
  detectContentBox,
  rotateDataUrl,
  type CropBox,
} from "@/lib/image-process";
import { t } from "@/lib/i18n";
import { useSettings } from "@/stores/settings";

type Handle = "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r" | "move";

const MIN = 0.08;
const HIT_PX = 44;

function hitHandle(
  px: number,
  py: number,
  width: number,
  height: number,
  box: CropBox,
): Handle | null {
  const corners: [Handle, number, number][] = [
    ["tl", box.l * width, box.t * height],
    ["tr", box.r * width, box.t * height],
    ["bl", box.l * width, box.b * height],
    ["br", box.r * width, box.b * height],
  ];
  for (const [name, cx, cy] of corners) {
    if (Math.abs(px - cx) <= HIT_PX && Math.abs(py - cy) <= HIT_PX) return name;
  }
  const mx = ((box.l + box.r) / 2) * width;
  const my = ((box.t + box.b) / 2) * height;
  const edges: [Handle, number, number][] = [
    ["t", mx, box.t * height],
    ["b", mx, box.b * height],
    ["l", box.l * width, my],
    ["r", box.r * width, my],
  ];
  for (const [name, cx, cy] of edges) {
    if (Math.abs(px - cx) <= HIT_PX && Math.abs(py - cy) <= HIT_PX) return name;
  }
  if (
    px >= box.l * width &&
    px <= box.r * width &&
    py >= box.t * height &&
    py <= box.b * height
  ) {
    return "move";
  }
  return null;
}

export function CropEditor({
  src,
  onConfirm,
  onCancel,
}: {
  src: string;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const lang = useSettings((s) => s.lang);
  const parentRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState(src);
  const [box, setBox] = useState<CropBox>({ l: 0.04, t: 0.04, r: 0.96, b: 0.96 });
  const [busy, setBusy] = useState(false);
  const [frame, setFrame] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const drag = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    origin: CropBox;
  } | null>(null);

  const measure = () => {
    const parent = parentRef.current;
    const img = imgRef.current;
    if (!parent || !img) return;
    const pr = parent.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    if (ir.width < 8 || ir.height < 8) return;
    setFrame({
      left: ir.left - pr.left,
      top: ir.top - pr.top,
      width: ir.width,
      height: ir.height,
    });
  };

  useEffect(() => {
    setImage(src);
    let cancelled = false;
    void detectContentBox(src).then((next) => {
      if (!cancelled) setBox(next);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  useLayoutEffect(() => {
    measure();
    const parent = parentRef.current;
    const img = imgRef.current;
    const ro = new ResizeObserver(() => measure());
    if (parent) ro.observe(parent);
    if (img) ro.observe(img);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [image]);

  const applyPointer = (clientX: number, clientY: number) => {
    const d = drag.current;
    const stage = stageRef.current;
    if (!d || !stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;
    const dx = (clientX - d.startX) / rect.width;
    const dy = (clientY - d.startY) / rect.height;
    const next = { ...d.origin };
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    if (d.handle === "move") {
      const w = d.origin.r - d.origin.l;
      const h = d.origin.b - d.origin.t;
      next.l = d.origin.l + dx;
      next.t = d.origin.t + dy;
      next.r = next.l + w;
      next.b = next.t + h;
      if (next.l < 0) {
        next.l = 0;
        next.r = w;
      }
      if (next.t < 0) {
        next.t = 0;
        next.b = h;
      }
      if (next.r > 1) {
        next.r = 1;
        next.l = 1 - w;
      }
      if (next.b > 1) {
        next.b = 1;
        next.t = 1 - h;
      }
    } else {
      if (d.handle === "l" || d.handle === "tl" || d.handle === "bl") {
        next.l = Math.min(d.origin.r - MIN, clamp(d.origin.l + dx));
      }
      if (d.handle === "r" || d.handle === "tr" || d.handle === "br") {
        next.r = Math.max(d.origin.l + MIN, clamp(d.origin.r + dx));
      }
      if (d.handle === "t" || d.handle === "tl" || d.handle === "tr") {
        next.t = Math.min(d.origin.b - MIN, clamp(d.origin.t + dy));
      }
      if (d.handle === "b" || d.handle === "bl" || d.handle === "br") {
        next.b = Math.max(d.origin.t + MIN, clamp(d.origin.b + dy));
      }
    }
    setBox(next);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const handle = hitHandle(
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height,
      box,
    );
    if (!handle) return;
    e.preventDefault();
    e.stopPropagation();
    stage.setPointerCapture(e.pointerId);
    drag.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origin: box,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    e.preventDefault();
    applyPointer(e.clientX, e.clientY);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    applyPointer(e.clientX, e.clientY);
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const cropped = await cropDataUrl(image, box);
      onConfirm(cropped);
    } finally {
      setBusy(false);
    }
  };

  const rotate = async () => {
    setBusy(true);
    try {
      const next = await rotateDataUrl(image, 90);
      setImage(next);
      setBox(await detectContentBox(next));
    } finally {
      setBusy(false);
    }
  };

  const skip = () => onConfirm(image);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        ref={parentRef}
        className="crop-stage relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-ink p-4"
      >
        <img
          ref={imgRef}
          src={image}
          alt=""
          className="crop-photo pointer-events-none block max-h-full w-auto max-w-full select-none"
          draggable={false}
          onLoad={measure}
        />
        {frame.width > 0 && (
          <div
            ref={stageRef}
            className="absolute touch-none select-none"
            style={{
              left: frame.left,
              top: frame.top,
              width: frame.width,
              height: frame.height,
              touchAction: "none",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
          >
            <div
              className="absolute border-2 border-accent"
              style={{
                left: `${box.l * 100}%`,
                top: `${box.t * 100}%`,
                width: `${(box.r - box.l) * 100}%`,
                height: `${(box.b - box.t) * 100}%`,
                boxShadow:
                  "0 0 0 9999px color-mix(in oklab, var(--ink) 62%, transparent)",
              }}
            >
              <span className="crop-grid" />
              <span className="crop-handle tl" />
              <span className="crop-handle tr" />
              <span className="crop-handle bl" />
              <span className="crop-handle br" />
              <span className="crop-edge t" />
              <span className="crop-edge b" />
              <span className="crop-edge l" />
              <span className="crop-edge r" />
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          <X className="size-4" />
          {t(lang, "cancel")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void rotate()}
          disabled={busy}
          aria-label={t(lang, "rotate")}
        >
          <RotateCw className="size-4" />
        </Button>
        <Button type="button" variant="ghost" onClick={skip} disabled={busy}>
          {t(lang, "skipCrop")}
        </Button>
        <Button
          type="button"
          className="min-w-32 flex-1"
          onClick={() => void confirm()}
          disabled={busy}
        >
          <Check className="size-4" />
          {t(lang, "confirmCrop")}
        </Button>
      </div>
    </div>
  );
}
