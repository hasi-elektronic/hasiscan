export type FilterId = "original" | "magic" | "bw" | "color";

export const MAX_EDGE = 2000;
export const JPEG_QUALITY = 0.88;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = src;
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(header ?? "")?.[1] ?? "image/jpeg";
  const binary = atob(data ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality = JPEG_QUALITY,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob-failed"))),
      "image/jpeg",
      quality,
    );
  });
}

export function fitCanvas(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  maxEdge = MAX_EDGE,
): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function fileToFittedDataUrl(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = fitCanvas(img, img.naturalWidth, img.naturalHeight);
    const blob = await canvasToJpeg(canvas);
    return blobToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type CropBox = { l: number; t: number; r: number; b: number };

export async function cropDataUrl(src: string, box: CropBox): Promise<string> {
  const img = await loadImage(src);
  const x = Math.round(Math.min(box.l, box.r) * img.naturalWidth);
  const y = Math.round(Math.min(box.t, box.b) * img.naturalHeight);
  const w = Math.max(
    1,
    Math.round(Math.abs(box.r - box.l) * img.naturalWidth),
  );
  const h = Math.max(
    1,
    Math.round(Math.abs(box.b - box.t) * img.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-2d");
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  const fitted = fitCanvas(canvas, w, h);
  const blob = await canvasToJpeg(fitted);
  return blobToDataUrl(blob);
}

export async function rotateDataUrl(src: string, degrees: 90 | -90): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  const cw = img.naturalHeight;
  const ch = img.naturalWidth;
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-2d");
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  const blob = await canvasToJpeg(canvas);
  return blobToDataUrl(blob);
}

export async function detectContentBox(src: string): Promise<CropBox> {
  const fallback = { l: 0.04, t: 0.04, r: 0.96, b: 0.96 };
  try {
    const img = await loadImage(src);
    const max = 180;
    const scale = max / Math.max(img.naturalWidth, img.naturalHeight);
    const w = Math.max(8, Math.round(img.naturalWidth * scale));
    const h = Math.max(8, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fallback;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const lum = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        lum[y * w + x] = luma(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
      }
    }

    let borderSum = 0;
    let borderN = 0;
    const band = 3;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (y < band || y >= h - band || x < band || x >= w - band) {
          borderSum += lum[y * w + x] ?? 0;
          borderN++;
        }
      }
    }
    const border = borderN ? borderSum / borderN : 0;
    const thr = border < 110 ? Math.max(155, border + 50) : Math.min(210, border + 24);

    const rowFrac = (y: number) => {
      let n = 0;
      for (let x = 0; x < w; x++) if ((lum[y * w + x] ?? 0) > thr) n++;
      return n / w;
    };
    const colFrac = (x: number) => {
      let n = 0;
      for (let y = 0; y < h; y++) if ((lum[y * w + x] ?? 0) > thr) n++;
      return n / h;
    };

    const minFrac = 0.16;
    let top = 0;
    let bottom = h - 1;
    let left = 0;
    let right = w - 1;
    for (let y = 0; y < h; y++) {
      if (rowFrac(y) >= minFrac) {
        top = y;
        break;
      }
    }
    for (let y = h - 1; y >= 0; y--) {
      if (rowFrac(y) >= minFrac) {
        bottom = y;
        break;
      }
    }
    for (let x = 0; x < w; x++) {
      if (colFrac(x) >= minFrac) {
        left = x;
        break;
      }
    }
    for (let x = w - 1; x >= 0; x--) {
      if (colFrac(x) >= minFrac) {
        right = x;
        break;
      }
    }

    if (right - left < w * 0.22 || bottom - top < h * 0.22) return fallback;

    const padX = 0.016;
    const padY = 0.016;
    return {
      l: Math.max(0, left / w - padX),
      t: Math.max(0, top / h - padY),
      r: Math.min(1, (right + 1) / w + padX),
      b: Math.min(1, (bottom + 1) / h + padY),
    };
  } catch {
    return fallback;
  }
}

function luma(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function otsuThreshold(hist: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * (hist[i] ?? 0);
  let sumB = 0;
  let wB = 0;
  let max = 0;
  let threshold = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i] ?? 0;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * (hist[i] ?? 0);
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) {
      max = between;
      threshold = i;
    }
  }
  return threshold;
}

function autoLevels(data: Uint8ClampedArray) {
  const n = data.length / 4;
  const lumas: number[] = new Array(n);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lumas[p] = luma(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
  }
  const sorted = lumas.slice().sort((a, b) => a - b);
  const lo = sorted[Math.floor(n * 0.02)] ?? 0;
  const hi = sorted[Math.floor(n * 0.98)] ?? 255;
  const span = Math.max(8, hi - lo);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c] ?? 0;
      data[i + c] = Math.max(0, Math.min(255, ((v - lo) / span) * 255));
    }
  }
}

function saturate(data: Uint8ClampedArray, amount: number) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const y = luma(r, g, b);
    data[i] = Math.max(0, Math.min(255, y + (r - y) * amount));
    data[i + 1] = Math.max(0, Math.min(255, y + (g - y) * amount));
    data[i + 2] = Math.max(0, Math.min(255, y + (b - y) * amount));
  }
}

function contrast(data: Uint8ClampedArray, factor: number) {
  const intercept = 128 * (1 - factor);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      data[i + c] = Math.max(
        0,
        Math.min(255, (data[i + c] ?? 0) * factor + intercept),
      );
    }
  }
}

export async function applyFilter(
  src: string,
  filter: FilterId,
): Promise<string> {
  if (filter === "original") return src;
  const img = await loadImage(src);
  const canvas = fitCanvas(img, img.naturalWidth, img.naturalHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-2d");
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;

  if (filter === "magic") {
    autoLevels(data);
    contrast(data, 1.18);
    saturate(data, 0.85);
  } else if (filter === "color") {
    autoLevels(data);
    contrast(data, 1.22);
    saturate(data, 1.25);
  } else if (filter === "bw") {
    const hist = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      const y = Math.round(
        luma(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0),
      );
      hist[y] = (hist[y] ?? 0) + 1;
      data[i] = y;
      data[i + 1] = y;
      data[i + 2] = y;
    }
    const thr = otsuThreshold(hist, canvas.width * canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      const v = (data[i] ?? 0) > thr - 8 ? 255 : 18;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  }

  ctx.putImageData(image, 0, 0);
  const blob = await canvasToJpeg(canvas, filter === "bw" ? 0.92 : JPEG_QUALITY);
  return blobToDataUrl(blob);
}

export async function makeThumb(src: string, max = 360): Promise<string> {
  const img = await loadImage(src);
  const canvas = fitCanvas(img, img.naturalWidth, img.naturalHeight, max);
  const blob = await canvasToJpeg(canvas, 0.72);
  return blobToDataUrl(blob);
}

export async function probeSize(
  src: string,
): Promise<{ width: number; height: number }> {
  const img = await loadImage(src);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
