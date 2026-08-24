import jsQR from "jsqr";

export interface QrHit {
  value: string;
  format: string;
}

type Detector = {
  detect: (
    source: ImageBitmapSource,
  ) => Promise<Array<{ rawValue: string; format: string }>>;
};

let detector: Detector | null | undefined;

function getDetector(): Detector | null {
  if (detector !== undefined) return detector;
  const Ctor = (
    globalThis as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
    }
  ).BarcodeDetector;
  if (!Ctor) {
    detector = null;
    return null;
  }
  try {
    detector = new Ctor({
      formats: [
        "qr_code",
        "ean_13",
        "ean_8",
        "code_128",
        "code_39",
        "upc_a",
        "upc_e",
        "data_matrix",
        "pdf417",
        "aztec",
      ],
    });
  } catch {
    detector = null;
  }
  return detector;
}

export async function detectFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<QrHit | null> {
  const native = getDetector();
  if (native) {
    try {
      const hits = await native.detect(canvas);
      const hit = hits[0];
      if (hit?.rawValue) {
        return { value: hit.rawValue, format: hit.format || "unknown" };
      }
    } catch {
      /* fall through to jsQR */
    }
  }

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(image.data, image.width, image.height, {
    inversionAttempts: "attemptBoth",
  });
  if (!code?.data) return null;
  return { value: code.data, format: "qr_code" };
}

export type QrKind = "url" | "wifi" | "text";

export function classifyQr(value: string): QrKind {
  const v = value.trim();
  if (/^WIFI:/i.test(v)) return "wifi";
  if (/^https?:\/\//i.test(v) || /^www\./i.test(v)) return "url";
  return "text";
}

export function parseWifi(value: string): { ssid: string; pass: string } | null {
  const ssid = /S:([^;]*)/.exec(value)?.[1] ?? "";
  const pass = /P:([^;]*)/.exec(value)?.[1] ?? "";
  if (!ssid) return null;
  return { ssid, pass };
}

export function hrefFor(value: string): string | null {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;
  return null;
}

export function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => void ctx.close();
  } catch {
    /* ignore */
  }
}
