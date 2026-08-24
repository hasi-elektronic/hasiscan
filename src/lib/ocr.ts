import type { Lang } from "@/lib/i18n";

const LANG_MAP: Record<Lang, string> = {
  tr: "tur+eng",
  de: "deu+eng",
  en: "eng",
};

export async function recognizeText(
  image: Blob | string,
  lang: Lang,
  onProgress?: (p: number) => void,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(LANG_MAP[lang], undefined, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(m.progress);
      }
    },
  });
  try {
    const result = await worker.recognize(image);
    return (result.data.text ?? "").trim();
  } finally {
    await worker.terminate();
  }
}
