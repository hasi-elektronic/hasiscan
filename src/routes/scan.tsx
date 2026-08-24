import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { CameraStage } from "@/components/scanner/camera-stage";
import { CropEditor } from "@/components/scanner/crop-editor";
import { FilterBar } from "@/components/scanner/filter-bar";
import { Button } from "@/components/ui/button";
import { applyFilter, blobToDataUrl, type FilterId } from "@/lib/image-process";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { useLibrary } from "@/stores/library";
import { useSettings } from "@/stores/settings";

type ScanSearch = { sample?: boolean; folder?: string };
type Step = "capture" | "crop" | "enhance";

export const Route = createFileRoute("/scan")({
  ssr: false,
  validateSearch: (raw: Record<string, unknown>): ScanSearch => ({
    sample: raw.sample === true || raw.sample === "1" || raw.sample === 1,
    folder: typeof raw.folder === "string" && raw.folder ? raw.folder : undefined,
  }),
  component: ScanPage,
});

function ScanPage() {
  const { sample, folder: folderFromUrl } = Route.useSearch();
  const navigate = useNavigate();
  const lang = useSettings((s) => s.lang);
  const autoMagic = useSettings((s) => s.autoMagic);
  const savePages = useLibrary((s) => s.savePages);
  const folders = useLibrary((s) => s.folders);
  const pendingCapture = useLibrary((s) => s.pendingCapture);
  const setPendingCapture = useLibrary((s) => s.setPendingCapture);

  const inbox = folders.find((f) => f.slug === "inbox");
  const [folderId, setFolderId] = useState(folderFromUrl ?? "");
  const [step, setStep] = useState<Step>("capture");
  const [source, setSource] = useState<string | null>(null);
  const [cropped, setCropped] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>(autoMagic ? "magic" : "original");
  const [preview, setPreview] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (folderFromUrl) {
      setFolderId(folderFromUrl);
      return;
    }
    setFolderId((current) => current || inbox?.id || "");
  }, [folderFromUrl, inbox?.id]);

  useEffect(() => {
    if (!pendingCapture) return;
    setSource(pendingCapture);
    setStep("crop");
    setPendingCapture(null);
  }, [pendingCapture, setPendingCapture]);

  useEffect(() => {
    if (!sample) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/samples/invoice.jpg");
      const blob = await res.blob();
      const url = await blobToDataUrl(blob);
      if (cancelled) return;
      setSource(url);
      setStep("crop");
    })();
    return () => {
      cancelled = true;
    };
  }, [sample]);

  useEffect(() => {
    if (!cropped) return;
    let cancelled = false;
    void (async () => {
      const next = await applyFilter(cropped, filter);
      if (!cancelled) setPreview(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [cropped, filter]);

  const onCapture = (dataUrl: string) => {
    setSource(dataUrl);
    setStep("crop");
  };

  const onCropped = (dataUrl: string) => {
    setCropped(dataUrl);
    setPreview(dataUrl);
    setStep("enhance");
  };

  const commitCurrent = async () => {
    if (!cropped) return pages;
    const rendered = await applyFilter(cropped, filter);
    return [...pages, rendered];
  };

  const addPage = async () => {
    const next = await commitCurrent();
    setPages(next);
    setSource(null);
    setCropped(null);
    setPreview(null);
    setFilter(autoMagic ? "magic" : "original");
    setStep("capture");
  };

  const goBack = () => {
    if (folderFromUrl) {
      void navigate({ to: "/folder/$id", params: { id: folderFromUrl } });
      return;
    }
    void navigate({ to: "/library" });
  };

  const save = async () => {
    setSaving(true);
    try {
      const all = await commitCurrent();
      if (all.length === 0) return;
      const doc = await savePages({
        title: sample ? t(lang, "sampleTitle") : t(lang, "untitled"),
        dataUrls: all,
        filter: "original",
        folderId: folderId || undefined,
      });
      toast.success(t(lang, "saved"));
      void navigate({ to: "/doc/$id", params: { id: doc.id } });
    } catch {
      toast.error(t(lang, "somethingWrong"));
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (step === "enhance") {
      setStep("crop");
      return;
    }
    if (step === "crop") {
      setSource(null);
      setStep("capture");
      return;
    }
    goBack();
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg md:min-h-0 md:flex-1">
      <header className="flex items-center justify-between gap-3 px-4 py-3 md:px-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t(lang, "cancel")}
          onClick={cancel}
        >
          <X className="size-5" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-medium">
            {step === "capture"
              ? t(lang, "scanDoc")
              : step === "crop"
                ? t(lang, "crop")
                : t(lang, "enhance")}
          </p>
          {(pages.length > 0 || step === "enhance") && (
            <p className="text-xs text-muted">
              {pages.length + (step === "enhance" ? 1 : 0)} {t(lang, "pagesCount")}
            </p>
          )}
        </div>
        <div className="size-11" />
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 md:px-2 md:pb-2">
        {step === "capture" && (
          <CameraStage
            onCapture={onCapture}
            overlay={
              <div className="finder" aria-hidden="true">
                <span />
              </div>
            }
          />
        )}

        {step === "crop" && source && (
          <CropEditor
            src={source}
            onConfirm={onCropped}
            onCancel={() => {
              setSource(null);
              setStep("capture");
            }}
          />
        )}

        {step === "enhance" && cropped && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-ink">
              <img
                src={preview ?? cropped}
                alt=""
                className="absolute inset-0 size-full object-contain"
              />
            </div>
            <FilterBar src={cropped} value={filter} onChange={setFilter} />
            {folders.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">
                  {t(lang, "saveTo")}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => setFolderId(folder.id)}
                      className={cn(
                        "h-9 shrink-0 rounded-full px-4 text-sm font-medium ring-1 transition-colors duration-150",
                        folderId === folder.id
                          ? "bg-accent text-accent-fg ring-accent"
                          : "bg-surface text-muted ring-border",
                      )}
                    >
                      {folder.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => void addPage()}
              >
                <Plus className="size-4" />
                {t(lang, "addPage")}
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={saving}
                onClick={() => void save()}
              >
                <Save className="size-4" />
                {t(lang, "save")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
