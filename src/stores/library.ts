import { create } from "zustand";
import { uid } from "@/lib/id";
import type { Lang } from "@/lib/i18n";
import {
  applyFilter,
  blobToDataUrl,
  dataUrlToBlob,
  makeThumb,
  probeSize,
  type FilterId,
} from "@/lib/image-process";
import {
  clearAll,
  deleteDocument,
  deleteFolderRecord,
  ensureFolders,
  listDocuments,
  putDocument,
  putFolder,
  putPage,
  saveNewDocument,
  type DocCategory,
  type ScanDocument,
  type ScanFolder,
  type ScanPage,
} from "@/lib/storage";

interface LibraryState {
  docs: ScanDocument[];
  folders: ScanFolder[];
  ready: boolean;
  pendingCapture: string | null;
  hydrate: (lang: Lang) => Promise<void>;
  setPendingCapture: (url: string | null) => void;
  savePages: (input: {
    title: string;
    dataUrls: string[];
    filter: FilterId;
    folderId?: string;
    category?: DocCategory;
  }) => Promise<ScanDocument>;
  saveQr: (value: string, folderId?: string) => Promise<ScanDocument>;
  rename: (id: string, title: string) => Promise<void>;
  setOcr: (id: string, text: string) => Promise<void>;
  moveDoc: (id: string, folderId: string) => Promise<void>;
  setCategory: (id: string, category: DocCategory) => Promise<void>;
  replacePage: (page: ScanPage) => Promise<void>;
  remove: (id: string) => Promise<void>;
  createFolder: (name: string) => Promise<ScanFolder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  removeFolder: (id: string) => Promise<void>;
  wipe: (lang: Lang) => Promise<void>;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  docs: [],
  folders: [],
  ready: false,
  pendingCapture: null,
  hydrate: async (lang) => {
    try {
      const folders = await ensureFolders(lang);
      let docs = await listDocuments();
      const inbox = folders.find((f) => f.slug === "inbox") ?? folders[0];
      if (inbox) {
        const patched: ScanDocument[] = [];
        for (const doc of docs) {
          if (doc.folderId) {
            patched.push(doc);
            continue;
          }
          const next = { ...doc, folderId: inbox.id };
          await putDocument(next);
          patched.push(next);
        }
        docs = patched;
      }
      set({ folders, docs, ready: true });
    } catch {
      set({ ready: true });
    }
  },
  setPendingCapture: (pendingCapture) => set({ pendingCapture }),
  savePages: async ({ title, dataUrls, filter, folderId, category }) => {
    const now = Date.now();
    const id = uid("doc");
    const inbox = get().folders.find((f) => f.slug === "inbox");
    const pages: ScanPage[] = [];
    for (const src of dataUrls) {
      const filtered = await applyFilter(src, filter);
      const blob = dataUrlToBlob(filtered);
      const size = await probeSize(filtered);
      const pageId = uid("pg");
      pages.push({
        id: pageId,
        docId: id,
        blob,
        filter,
        width: size.width,
        height: size.height,
      });
    }
    const thumbSrc = await blobToDataUrl(pages[0]!.blob);
    const thumb = await makeThumb(thumbSrc);
    const doc: ScanDocument = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      type: "document",
      pageIds: pages.map((p) => p.id),
      thumb,
      folderId: folderId ?? inbox?.id,
      category: category ?? "receipts",
    };
    await saveNewDocument(doc, pages);
    set({ docs: [doc, ...get().docs.filter((d) => d.id !== id)] });
    return doc;
  },
  saveQr: async (value, folderId) => {
    const now = Date.now();
    const inbox = get().folders.find((f) => f.slug === "inbox");
    const doc: ScanDocument = {
      id: uid("qr"),
      title: value.slice(0, 48),
      createdAt: now,
      updatedAt: now,
      type: "qr",
      pageIds: [],
      thumb: "",
      qrValue: value,
      folderId: folderId ?? inbox?.id,
      category: "other",
    };
    await putDocument(doc);
    set({ docs: [doc, ...get().docs.filter((d) => d.id !== doc.id)] });
    return doc;
  },
  rename: async (id, title) => {
    const current = get().docs.find((d) => d.id === id);
    if (!current) return;
    const next = { ...current, title, updatedAt: Date.now() };
    await putDocument(next);
    set({ docs: get().docs.map((d) => (d.id === id ? next : d)) });
  },
  setOcr: async (id, text) => {
    const current = get().docs.find((d) => d.id === id);
    if (!current) return;
    const next = { ...current, ocrText: text, updatedAt: Date.now() };
    await putDocument(next);
    set({ docs: get().docs.map((d) => (d.id === id ? next : d)) });
  },
  moveDoc: async (id, folderId) => {
    const current = get().docs.find((d) => d.id === id);
    if (!current) return;
    const next = { ...current, folderId, updatedAt: Date.now() };
    await putDocument(next);
    set({ docs: get().docs.map((d) => (d.id === id ? next : d)) });
  },
  setCategory: async (id, category) => {
    const current = get().docs.find((d) => d.id === id);
    if (!current) return;
    const next = { ...current, category, updatedAt: Date.now() };
    await putDocument(next);
    set({ docs: get().docs.map((d) => (d.id === id ? next : d)) });
  },
  replacePage: async (page) => {
    await putPage(page);
    const current = get().docs.find((d) => d.id === page.docId);
    if (!current) return;
    const next = { ...current, updatedAt: Date.now() };
    if (current.pageIds[0] === page.id) {
      const thumbSrc = await blobToDataUrl(page.blob);
      next.thumb = await makeThumb(thumbSrc);
    }
    await putDocument(next);
    set({ docs: get().docs.map((d) => (d.id === next.id ? next : d)) });
  },
  remove: async (id) => {
    await deleteDocument(id);
    set({ docs: get().docs.filter((d) => d.id !== id) });
  },
  createFolder: async (name) => {
    const now = Date.now();
    const folder: ScanFolder = {
      id: uid("fld"),
      name: name.trim() || "Folder",
      createdAt: now,
      updatedAt: now,
    };
    await putFolder(folder);
    set({ folders: [...get().folders, folder] });
    return folder;
  },
  renameFolder: async (id, name) => {
    const current = get().folders.find((f) => f.id === id);
    if (!current) return;
    const next = { ...current, name, updatedAt: Date.now() };
    await putFolder(next);
    set({ folders: get().folders.map((f) => (f.id === id ? next : f)) });
  },
  removeFolder: async (id) => {
    const inbox = get().folders.find((f) => f.slug === "inbox");
    const fallback =
      inbox && inbox.id !== id
        ? inbox.id
        : get().folders.find((f) => f.id !== id)?.id;
    for (const doc of get().docs.filter((d) => d.folderId === id)) {
      const next = { ...doc, folderId: fallback, updatedAt: Date.now() };
      await putDocument(next);
    }
    await deleteFolderRecord(id);
    set({
      folders: get().folders.filter((f) => f.id !== id),
      docs: get().docs.map((d) =>
        d.folderId === id ? { ...d, folderId: fallback } : d,
      ),
    });
  },
  wipe: async (lang) => {
    await clearAll();
    const folders = await ensureFolders(lang);
    set({ docs: [], folders });
  },
}));
