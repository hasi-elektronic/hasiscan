import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Camera,
  ChevronLeft,
  FolderPlus,
  ImagePlus,
  QrCode,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { fileToFittedDataUrl } from "@/lib/image-process";
import { t } from "@/lib/i18n";
import { useLibrary } from "@/stores/library";
import { useSettings } from "@/stores/settings";

export const Route = createFileRoute("/folder/$id")({
  ssr: false,
  component: FolderPage,
});

function FolderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const lang = useSettings((s) => s.lang);
  const docs = useLibrary((s) => s.docs);
  const folders = useLibrary((s) => s.folders);
  const renameFolder = useLibrary((s) => s.renameFolder);
  const removeFolder = useLibrary((s) => s.removeFolder);
  const setPendingCapture = useLibrary((s) => s.setPendingCapture);
  const folder = folders.find((f) => f.id === id);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(folder?.name ?? "");

  const items = useMemo(
    () => docs.filter((d) => d.folderId === id),
    [docs, id],
  );

  if (!folder) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-start gap-4 pt-12">
        <p className="text-muted">{t(lang, "emptyFolder")}</p>
        <Button
          variant="secondary"
          onClick={() => void navigate({ to: "/library" })}
        >
          {t(lang, "library")}
        </Button>
      </div>
    );
  }

  const pickGallery = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await fileToFittedDataUrl(file);
    setPendingCapture(dataUrl);
    void navigate({ to: "/scan", search: { folder: folder.id } });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-32">
      <header className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t(lang, "back")}
          onClick={() => void navigate({ to: "/library" })}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const next = title.trim() || folder.name;
            setTitle(next);
            if (next !== folder.name) void renameFolder(folder.id, next);
          }}
          className="h-11 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 text-lg font-semibold tracking-tight outline-none focus:border-border focus:bg-surface"
          aria-label={t(lang, "folderName")}
        />
        {folder.slug !== "inbox" && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t(lang, "deleteFolder")}
            className="text-danger"
            onClick={async () => {
              if (!confirm(t(lang, "deleteFolderConfirm"))) return;
              await removeFolder(folder.id);
              toast.success(t(lang, "saved"));
              void navigate({ to: "/library" });
            }}
          >
            <Trash2 className="size-5" />
          </Button>
        )}
      </header>

      <p className="text-sm text-muted">
        {items.length} {t(lang, "documentsCount")}
        {items[0] ? ` · ${formatDate(items[0].updatedAt, lang)}` : ""}
      </p>

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-2xl bg-surface p-6 ring-1 ring-border">
          <FolderPlus className="size-6 text-muted" />
          <div>
            <p className="font-medium">{t(lang, "emptyFolder")}</p>
            <p className="mt-1 text-sm text-muted">{t(lang, "emptyFolderHint")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                void navigate({ to: "/scan", search: { folder: folder.id } })
              }
            >
              {t(lang, "scanHere")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => galleryRef.current?.click()}
            >
              {t(lang, "gallery")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((doc) => (
            <Link
              key={doc.id}
              to="/doc/$id"
              params={{ id: doc.id }}
              className="overflow-hidden rounded-2xl bg-surface ring-1 ring-border transition-transform duration-150 active:scale-[0.96]"
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
                    <QrCode className="size-7 text-muted" />
                  </div>
                )}
              </div>
              <div className="space-y-0.5 p-3">
                <p className="truncate text-sm font-medium">{doc.title}</p>
                <p className="text-xs text-faint">
                  {formatDate(doc.updatedAt, lang)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 z-20 flex justify-center scan-dock">
        <div className="pointer-events-auto flex items-center gap-6 rounded-full bg-surface px-6 py-2 shadow-lg ring-1 ring-border">
          <Link
            to="/library"
            aria-label={t(lang, "allFolders")}
            className="flex size-11 items-center justify-center text-muted"
          >
            <FolderPlus className="size-5" />
          </Link>
          <Link
            to="/scan"
            search={{ folder: folder.id }}
            aria-label={t(lang, "scanDoc")}
            className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg transition-transform duration-150 active:scale-[0.96]"
          >
            <Camera className="size-6" />
          </Link>
          <button
            type="button"
            aria-label={t(lang, "gallery")}
            onClick={() => galleryRef.current?.click()}
            className="flex size-11 items-center justify-center text-muted"
          >
            <ImagePlus className="size-5" />
          </button>
        </div>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pickGallery(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
