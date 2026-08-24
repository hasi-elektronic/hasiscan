import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  Copy,
  Crop,
  Download,
  FileText,
  QrCode,
  RotateCw,
  Share2,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { CropEditor } from "@/components/scanner/crop-editor";
import { Button } from "@/components/ui/button";
import {
  blobToDataUrl,
  dataUrlToBlob,
  downloadBlob,
  probeSize,
  rotateDataUrl,
} from "@/lib/image-process";
import { t, type MsgKey } from "@/lib/i18n";
import { recognizeText } from "@/lib/ocr";
import { pagesToPdf } from "@/lib/pdf-export";
import { hrefFor } from "@/lib/qr";
import { getPages, type DocCategory, type ScanPage } from "@/lib/storage";
import { useLibrary } from "@/stores/library";
import { useSettings } from "@/stores/settings";

export const Route = createFileRoute("/doc/$id")({
  ssr: false,
  component: DocPage,
});

const CATS: { id: DocCategory; key: MsgKey }[] = [
  { id: "receipts", key: "catReceipts" },
  { id: "finance", key: "catFinance" },
  { id: "id", key: "catId" },
  { id: "health", key: "catHealth" },
  { id: "other", key: "catOther" },
];

function DocPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const lang = useSettings((s) => s.lang);
  const docs = useLibrary((s) => s.docs);
  const folders = useLibrary((s) => s.folders);
  const rename = useLibrary((s) => s.rename);
  const setOcr = useLibrary((s) => s.setOcr);
  const remove = useLibrary((s) => s.remove);
  const moveDoc = useLibrary((s) => s.moveDoc);
  const setCategory = useLibrary((s) => s.setCategory);
  const replacePage = useLibrary((s) => s.replacePage);
  const doc = docs.find((d) => d.id === id);

  const [pages, setPages] = useState<ScanPage[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [title, setTitle] = useState(doc?.title ?? "");
  const [recropSrc, setRecropSrc] = useState<string | null>(null);
  const [pageBusy, setPageBusy] = useState(false);

  useEffect(() => {
    setTitle(doc?.title ?? "");
  }, [doc?.title]);

  useEffect(() => {
    if (!doc?.pageIds.length) {
      setPages([]);
      setUrls([]);
      return;
    }
    let cancelled = false;
    const created: string[] = [];
    void (async () => {
      const loaded = await getPages(doc.pageIds);
      if (cancelled) return;
      setPages(loaded);
      const next = loaded.map((p) => {
        const u = URL.createObjectURL(p.blob);
        created.push(u);
        return u;
      });
      setUrls(next);
    })();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [doc?.id, doc?.updatedAt, doc?.pageIds.join("|")]);

  const currentUrl = urls[active];

  const runOcr = async () => {
    if (!pages[0]) return;
    setOcrBusy(true);
    setOcrProgress(0);
    try {
      const texts: string[] = [];
      for (let i = 0; i < pages.length; i++) {
        const text = await recognizeText(pages[i]!.blob, lang, (p) => {
          setOcrProgress((i + p) / pages.length);
        });
        if (text) texts.push(text);
      }
      const joined = texts.join("\n\n").trim();
      if (!joined) {
        toast.error(t(lang, "ocrEmpty"));
        return;
      }
      await setOcr(id, joined);
      toast.success(t(lang, "ocrResult"));
    } catch {
      toast.error(t(lang, "ocrFailed"));
    } finally {
      setOcrBusy(false);
    }
  };

  const exportPdf = async () => {
    if (!pages.length) return;
    const blob = await pagesToPdf(pages.map((p) => p.blob));
    downloadBlob(blob, `${doc?.title || "scan"}.pdf`);
    toast.success(t(lang, "pdfReady"));
  };

  const exportImage = async () => {
    const page = pages[active];
    if (!page) return;
    downloadBlob(page.blob, `${doc?.title || "scan"}-${active + 1}.jpg`);
  };

  const share = async () => {
    if (!pages.length || !navigator.share) {
      await exportPdf();
      return;
    }
    const blob = await pagesToPdf(pages.map((p) => p.blob));
    const file = new File([blob], `${doc?.title || "scan"}.pdf`, {
      type: "application/pdf",
    });
    try {
      await navigator.share({ files: [file], title: doc?.title });
    } catch {
      downloadBlob(blob, `${doc?.title || "scan"}.pdf`);
    }
  };

  const applyPage = async (dataUrl: string) => {
    const page = pages[active];
    if (!page) return;
    setPageBusy(true);
    try {
      const blob = dataUrlToBlob(dataUrl);
      const size = await probeSize(dataUrl);
      await replacePage({
        ...page,
        blob,
        width: size.width,
        height: size.height,
      });
      setRecropSrc(null);
      toast.success(t(lang, "saved"));
    } catch {
      toast.error(t(lang, "somethingWrong"));
    } finally {
      setPageBusy(false);
    }
  };

  const rotatePage = async () => {
    const page = pages[active];
    if (!page) return;
    setPageBusy(true);
    try {
      const src = await blobToDataUrl(page.blob);
      const next = await rotateDataUrl(src, 90);
      await applyPage(next);
    } finally {
      setPageBusy(false);
    }
  };

  const startRecrop = async () => {
    const page = pages[active];
    if (!page) return;
    const src = await blobToDataUrl(page.blob);
    setRecropSrc(src);
  };

  const href = doc?.qrValue ? hrefFor(doc.qrValue) : null;

  if (!doc) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-start gap-4 pt-12">
        <p className="text-muted">{t(lang, "emptyLibrary")}</p>
        <Button variant="secondary" onClick={() => void navigate({ to: "/library" })}>
          {t(lang, "library")}
        </Button>
      </div>
    );
  }

  if (recropSrc) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <CropEditor
          src={recropSrc}
          onConfirm={(url) => void applyPage(url)}
          onCancel={() => setRecropSrc(null)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t(lang, "back")}
          onClick={() =>
            void navigate(
              doc.folderId
                ? { to: "/folder/$id", params: { id: doc.folderId } }
                : { to: "/library" },
            )
          }
        >
          <ChevronLeft className="size-5" />
        </Button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const next = title.trim() || t(lang, "untitled");
            setTitle(next);
            if (next !== doc.title) void rename(doc.id, next);
          }}
          className="h-11 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 text-lg font-semibold tracking-tight outline-none focus:border-border focus:bg-surface"
          aria-label={t(lang, "titleLabel")}
        />
      </header>

      {doc.type === "qr" ? (
        <div className="rounded-2xl bg-surface p-6 ring-1 ring-border">
          <div className="mb-3 flex items-center gap-2 text-accent">
            <QrCode className="size-4" />
            <span className="text-xs font-medium tracking-wide uppercase">
              {t(lang, "qrCode")}
            </span>
          </div>
          <p className="break-all text-base leading-relaxed">{doc.qrValue}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {href && (
              <Button size="sm" asChild>
                <a href={href} target="_blank" rel="noreferrer">
                  {t(lang, "openLink")}
                </a>
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                if (doc.qrValue) await navigator.clipboard.writeText(doc.qrValue);
                toast.success(t(lang, "copied"));
              }}
            >
              <Copy className="size-3.5" />
              {t(lang, "copy")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="preview-sheet relative overflow-hidden rounded-2xl bg-ink">
            {currentUrl ? (
              <img
                src={currentUrl}
                alt=""
                className="mx-auto w-full object-contain"
              />
            ) : (
              <div className="flex aspect-page items-center justify-center">
                <FileText className="size-8 text-muted" />
              </div>
            )}
          </div>
          {urls.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {urls.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`h-20 w-14 shrink-0 overflow-hidden rounded-lg ring-2 ${
                    i === active ? "ring-accent" : "ring-transparent"
                  }`}
                >
                  <img src={url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {doc.type === "document" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Button variant="secondary" onClick={() => void exportPdf()}>
            <Download className="size-4" />
            {t(lang, "exportPdf")}
          </Button>
          <Button variant="secondary" onClick={() => void exportImage()}>
            <FileText className="size-4" />
            {t(lang, "exportImage")}
          </Button>
          <Button variant="secondary" onClick={() => void share()}>
            <Share2 className="size-4" />
            {t(lang, "share")}
          </Button>
          <Button
            variant="secondary"
            disabled={ocrBusy}
            onClick={() => void runOcr()}
          >
            <Type className="size-4" />
            {ocrBusy
              ? `${t(lang, "ocrRunning")} ${Math.round(ocrProgress * 100)}%`
              : t(lang, "ocr")}
          </Button>
          <Button
            variant="secondary"
            disabled={pageBusy}
            onClick={() => void startRecrop()}
          >
            <Crop className="size-4" />
            {t(lang, "recrop")}
          </Button>
          <Button
            variant="secondary"
            disabled={pageBusy}
            onClick={() => void rotatePage()}
          >
            <RotateCw className="size-4" />
            {t(lang, "rotate")}
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted uppercase">
            {t(lang, "saveTo")}
          </span>
          <select
            value={doc.folderId ?? ""}
            onChange={(e) => {
              if (e.target.value) void moveDoc(doc.id, e.target.value);
            }}
            className="h-11 rounded-xl bg-surface px-3 text-sm text-fg ring-1 ring-border outline-none"
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted uppercase">
            {t(lang, "category")}
          </span>
          <select
            value={doc.category ?? "other"}
            onChange={(e) => void setCategory(doc.id, e.target.value as DocCategory)}
            className="h-11 rounded-xl bg-surface px-3 text-sm text-fg ring-1 ring-border outline-none"
          >
            {CATS.map((item) => (
              <option key={item.id} value={item.id}>
                {t(lang, item.key)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {doc.ocrText && (
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-border">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">{t(lang, "ocrResult")}</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(doc.ocrText ?? "");
                toast.success(t(lang, "copied"));
              }}
            >
              <Copy className="size-3.5" />
              {t(lang, "copy")}
            </Button>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted">
            {doc.ocrText}
          </pre>
        </section>
      )}

      <Button
        variant="outline"
        className="self-start text-danger"
        onClick={async () => {
          if (!confirm(t(lang, "deleteConfirm"))) return;
          await remove(doc.id);
          void navigate({ to: "/library" });
        }}
      >
        <Trash2 className="size-4" />
        {t(lang, "delete")}
      </Button>
    </div>
  );
}
