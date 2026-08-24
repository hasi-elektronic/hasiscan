import type { FilterId } from "@/lib/image-process";
import { uid } from "@/lib/id";
import type { Lang } from "@/lib/i18n";

const DB_NAME = "hasiscan";
const DB_VERSION = 2;

export type DocCategory = "receipts" | "finance" | "id" | "health" | "other";

export interface ScanFolder {
  id: string;
  name: string;
  slug?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ScanDocument {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  type: "document" | "qr";
  pageIds: string[];
  thumb: string;
  ocrText?: string;
  qrValue?: string;
  folderId?: string;
  category?: DocCategory;
}

export interface ScanPage {
  id: string;
  docId: string;
  blob: Blob;
  filter: FilterId;
  width: number;
  height: number;
}

const FOLDER_NAMES: Record<string, Record<Lang, string>> = {
  inbox: { tr: "Gelen", de: "Eingang", en: "Inbox" },
  personal: { tr: "Kişisel", de: "Persönlich", en: "Personal" },
  accounting: { tr: "Muhasebe", de: "Buchhaltung", en: "Accounting" },
  hasi: { tr: "Hasi", de: "Hasi", en: "Hasi" },
  invoices: { tr: "Faturalar", de: "Rechnungen", en: "Invoices" },
  hamdi: { tr: "Hamdi", de: "Hamdi", en: "Hamdi" },
};

export const DEFAULT_FOLDER_SLUGS = [
  "inbox",
  "personal",
  "accounting",
  "hasi",
  "invoices",
  "hamdi",
] as const;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("docs")) {
        db.createObjectStore("docs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("pages")) {
        db.createObjectStore("pages", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("folders")) {
        db.createObjectStore("folders", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function listDocuments(): Promise<ScanDocument[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("docs", "readonly");
    const req = tx.objectStore("docs").getAll();
    req.onsuccess = () => {
      const rows = (req.result as ScanDocument[]).sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function listFolders(): Promise<ScanFolder[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("folders", "readonly");
    const req = tx.objectStore("folders").getAll();
    req.onsuccess = () => {
      const rows = (req.result as ScanFolder[]).sort(
        (a, b) => a.createdAt - b.createdAt,
      );
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getDocument(id: string): Promise<ScanDocument | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction("docs", "readonly").objectStore("docs").get(id);
    req.onsuccess = () => resolve(req.result as ScanDocument | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function getPage(id: string): Promise<ScanPage | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction("pages", "readonly").objectStore("pages").get(id);
    req.onsuccess = () => resolve(req.result as ScanPage | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function getPages(ids: string[]): Promise<ScanPage[]> {
  const pages: ScanPage[] = [];
  for (const id of ids) {
    const page = await getPage(id);
    if (page) pages.push(page);
  }
  return pages;
}

export async function putDocument(doc: ScanDocument): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("docs", "readwrite");
  tx.objectStore("docs").put(doc);
  await txDone(tx);
}

export async function putFolder(folder: ScanFolder): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("folders", "readwrite");
  tx.objectStore("folders").put(folder);
  await txDone(tx);
}

export async function putPage(page: ScanPage): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("pages", "readwrite");
  tx.objectStore("pages").put(page);
  await txDone(tx);
}

export async function saveNewDocument(
  doc: ScanDocument,
  pages: ScanPage[],
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(["docs", "pages"], "readwrite");
  tx.objectStore("docs").put(doc);
  for (const page of pages) tx.objectStore("pages").put(page);
  await txDone(tx);
}

export async function deleteDocument(id: string): Promise<void> {
  const doc = await getDocument(id);
  const db = await openDb();
  const tx = db.transaction(["docs", "pages"], "readwrite");
  tx.objectStore("docs").delete(id);
  for (const pageId of doc?.pageIds ?? []) {
    tx.objectStore("pages").delete(pageId);
  }
  await txDone(tx);
}

export async function deleteFolderRecord(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("folders", "readwrite");
  tx.objectStore("folders").delete(id);
  await txDone(tx);
}

export async function seedDefaultFolders(lang: Lang): Promise<ScanFolder[]> {
  const now = Date.now();
  const folders: ScanFolder[] = DEFAULT_FOLDER_SLUGS.map((slug, i) => ({
    id: uid("fld"),
    name: FOLDER_NAMES[slug]?.[lang] ?? slug,
    slug,
    createdAt: now + i,
    updatedAt: now + i,
  }));
  const db = await openDb();
  const tx = db.transaction("folders", "readwrite");
  for (const folder of folders) tx.objectStore("folders").put(folder);
  await txDone(tx);
  return folders;
}

export async function ensureFolders(lang: Lang): Promise<ScanFolder[]> {
  const existing = await listFolders();
  if (existing.length > 0) return existing;
  return seedDefaultFolders(lang);
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  const names = ["docs", "pages", "folders"].filter((n) =>
    db.objectStoreNames.contains(n),
  );
  const tx = db.transaction(names, "readwrite");
  for (const n of names) tx.objectStore(n).clear();
  await txDone(tx);
}

export function pageToObjectUrl(page: ScanPage): string {
  return URL.createObjectURL(page.blob);
}
