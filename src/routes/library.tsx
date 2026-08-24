import { useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Camera,
  FolderPlus,
  ImagePlus,
  LayoutGrid,
  List,
  QrCode,
  Search,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { fileToFittedDataUrl } from "@/lib/image-process";
import { t, type MsgKey } from "@/lib/i18n";
import type { DocCategory, ScanDocument, ScanFolder } from "@/lib/storage";
import { useLibrary } from "@/stores/library";
import { useSettings } from "@/stores/settings";

export const Route = createFileRoute("/library")({ component: LibraryPage });

const CATS: { id: "all" | DocCategory; key: MsgKey }[] = [
  { id: "receipts", key: "catReceipts" },
  { id: "finance", key: "catFinance" },
  { id: "id", key: "catId" },
  { id: "health", key: "catHealth" },
];

function FolderMosaic({ docs }: { docs: ScanDocument[] }) {
  const thumbs = docs.filter((d) => d.thumb).slice(0, 4);
  return (
    <div className="grid size-20 shrink-0 grid-cols-2 gap-px overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border">
      {Array.from({ length: 4 }).map((_, i) =>
        thumbs[i] ? (
          <img
            key={thumbs[i]!.id}
            src={thumbs[i]!.thumb}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div key={i} className="bg-surface" />
        ),
      )}
    </div>
  );
}

function LibraryPage() {
  const lang = useSettings((s) => s.lang);
  const docs = useLibrary((s) => s.docs);
  const folders = useLibrary((s) => s.folders);
  const ready = useLibrary((s) => s.ready);
  const createFolder = useLibrary((s) => s.createFolder);
  const setPendingCapture = useLibrary((s) => s.setPendingCapture);
  const navigate = useNavigate();
  const galleryRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<"all" | DocCategory>("all");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const q = query.trim().toLowerCase();
  const folderView = cat === "all";

  const docsByFolder = useMemo(() => {
    const map = new Map<string, ScanDocument[]>();
    for (const doc of docs) {
      const key = doc.folderId ?? "_";
      const list = map.get(key) ?? [];
      list.push(doc);
      map.set(key, list);
    }
    return map;
  }, [docs]);

  const visibleFolders = useMemo(() => {
    return folders.filter((folder) => {
      const list = docsByFolder.get(folder.id) ?? [];
      if (cat !== "all") {
        const has = list.some((d) => matchesCat(d, cat));
        if (!has) return false;
      }
      if (!q) return true;
      if (folder.name.toLowerCase().includes(q)) return true;
      return list.some(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.ocrText ?? "").toLowerCase().includes(q),
      );
    });
  }, [folders, docsByFolder, cat, q]);

  const matchedDocs = useMemo(() => {
    return docs.filter((d) => {
      if (cat !== "all" && !matchesCat(d, cat)) return false;
      if (!q) return cat !== "all";
      return (
        d.title.toLowerCase().includes(q) ||
        (d.ocrText ?? "").toLowerCase().includes(q) ||
        (d.qrValue ?? "").toLowerCase().includes(q)
      );
    });
  }, [docs, q, cat]);

  const submitFolder = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await createFolder(name);
    setNewName("");
    setCreating(false);
  };

  const pickGallery = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await fileToFittedDataUrl(file);
    setPendingCapture(dataUrl);
    void navigate({ to: "/scan" });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-32">
      <header className="flex items-center justify-between gap-3">
        <Link
          to="/settings"
          aria-label={t(lang, "settings")}
          className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface"
        >
          <Settings className="size-5" />
        </Link>
        <h1 className="font-display text-lg font-semibold tracking-tight">
          {t(lang, "myScans")}
        </h1>
        <button
          type="button"
          aria-label={t(lang, "newFolder")}
          onClick={() => setCreating(true)}
          className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface"
        >
          <FolderPlus className="size-5" />
        </button>
      </header>

      <label className="flex h-11 items-center gap-2 rounded-full bg-surface px-4 ring-1 ring-border">
        <Search className="size-4 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(lang, "searchText")}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCat("all")}
          aria-label={t(lang, "allFolders")}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full ring-1 transition-colors duration-150",
            cat === "all"
              ? "bg-surface-2 text-fg ring-border"
              : "bg-surface text-muted ring-border",
          )}
        >
          <List className="size-4" />
        </button>
        {CATS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCat(item.id)}
            className={cn(
              "h-9 shrink-0 rounded-full px-4 text-sm font-medium ring-1 transition-colors duration-150",
              cat === item.id
                ? "bg-accent text-accent-fg ring-accent"
                : "bg-surface text-muted ring-border",
            )}
          >
            {t(lang, item.key)}
          </button>
        ))}
      </div>

      {creating && (
        <form onSubmit={(e) => void submitFolder(e)} className="flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t(lang, "folderName")}
            className="h-11 min-w-0 flex-1 rounded-xl bg-surface px-3 text-sm ring-1 ring-border outline-none"
          />
          <Button type="submit" size="sm">
            {t(lang, "createFolder")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setCreating(false)}
          >
            {t(lang, "cancel")}
          </Button>
        </form>
      )}

      {!ready ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : visibleFolders.length === 0 && matchedDocs.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-2xl bg-surface p-6 ring-1 ring-border">
          <p className="text-lg font-medium">{t(lang, "emptyLibrary")}</p>
          <p className="text-sm text-muted">{t(lang, "emptyLibraryHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void navigate({ to: "/scan" })}>
              {t(lang, "newScan")}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void navigate({ to: "/scan", search: { sample: true } })
              }
            >
              {t(lang, "trySample")}
            </Button>
          </div>
        </div>
      ) : folderView ? (
        <ul className="divide-y divide-border">
          {visibleFolders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              docs={docsByFolder.get(folder.id) ?? []}
              lang={lang}
            />
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {matchedDocs.map((doc) => (
            <Link
              key={doc.id}
              to="/doc/$id"
              params={{ id: doc.id }}
              className="overflow-hidden rounded-2xl bg-surface ring-1 ring-border"
            >
              <div className="aspect-page bg-surface-2">
                {doc.thumb ? (
                  <img src={doc.thumb} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <QrCode className="size-7 text-muted" />
                  </div>
                )}
              </div>
              <p className="truncate px-3 py-2 text-sm font-medium">{doc.title}</p>
            </Link>
          ))}
        </div>
      )}

      {q && folderView && matchedDocs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            {t(lang, "document")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {matchedDocs.map((doc) => (
              <Link
                key={doc.id}
                to="/doc/$id"
                params={{ id: doc.id }}
                className="overflow-hidden rounded-2xl bg-surface ring-1 ring-border"
              >
                <div className="aspect-page bg-surface-2">
                  {doc.thumb ? (
                    <img src={doc.thumb} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <QrCode className="size-7 text-muted" />
                    </div>
                  )}
                </div>
                <p className="truncate px-3 py-2 text-sm font-medium">{doc.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="pointer-events-none fixed inset-x-0 z-20 flex justify-center scan-dock">
        <div className="pointer-events-auto flex items-center gap-6 rounded-full bg-surface px-6 py-2 shadow-lg ring-1 ring-border">
          <LayoutGrid className="size-5 text-muted" />
          <Link
            to="/scan"
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

function matchesCat(doc: ScanDocument, cat: DocCategory) {
  if ((doc.category ?? "other") === cat) return true;
  return cat === "receipts" && doc.type === "document" && !doc.category;
}

function FolderRow({
  folder,
  docs,
  lang,
}: {
  folder: ScanFolder;
  docs: ScanDocument[];
  lang: "tr" | "de" | "en";
}) {
  const latest = docs[0]?.updatedAt ?? folder.updatedAt;
  return (
    <li>
      <Link
        to="/folder/$id"
        params={{ id: folder.id }}
        className="flex items-center gap-4 py-4"
      >
        <FolderMosaic docs={docs} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{folder.name}</p>
          <p className="mt-0.5 text-sm text-muted">
            {docs.length} {t(lang, "documentsCount")} · {formatDate(latest, lang)}
          </p>
        </div>
      </Link>
    </li>
  );
}
