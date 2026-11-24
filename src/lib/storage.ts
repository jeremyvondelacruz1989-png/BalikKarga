import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { db } from "./db";

// Two storage drivers behind putBytes/getBytes; metadata and access checks live elsewhere.
// - Supabase Storage (live): set SUPABASE_URL and SUPABASE_SECRET_KEY. Files go to the private
//   bucket SUPABASE_BUCKET (default "uploads"); only the server can read or write them, and
//   /files/[id] streams them to the people allowed to see each file.
// - Local disk (Codespace, tests): used when those are not set. Files go to UPLOAD_DIR.

const ROOT = path.resolve(process.env.UPLOAD_DIR || "./uploads");
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  { mime: "application/pdf", ext: "pdf", test: (b) => b.subarray(0, 5).toString() === "%PDF-" },
];

const KEY_PATTERN = /^[a-zA-Z0-9_-]+\.[a-z]+$/;

let supabase: SupabaseClient | null | undefined;
function supabaseStorage() {
  if (supabase === undefined) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    supabase = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  }
  return supabase ? supabase.storage.from(process.env.SUPABASE_BUCKET || "uploads") : null;
}

/** Which driver is active, for logs and the admin page. */
export const storageDriver = () => (supabaseStorage() ? "supabase" : "disk");

async function putBytes(key: string, bytes: Buffer, contentType: string) {
  const bucket = supabaseStorage();
  if (bucket) {
    const { error } = await bucket.upload(key, bytes, { contentType, upsert: false });
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
    return;
  }
  await mkdir(ROOT, { recursive: true });
  await writeFile(path.join(ROOT, key), bytes);
}

export async function getBytes(key: string): Promise<Buffer> {
  if (!KEY_PATTERN.test(key)) throw new Error("Bad key");
  const bucket = supabaseStorage();
  if (bucket) {
    const { data, error } = await bucket.download(key);
    if (error || !data) throw new Error(`Supabase Storage download failed: ${error?.message ?? "no data"}`);
    return Buffer.from(await data.arrayBuffer());
  }
  return readFile(path.join(ROOT, key));
}

export class UploadError extends Error {}

/** Validates (type sniffed from content, size) and stores an uploaded file. */
export async function saveUpload(
  file: File,
  ownerId: string,
  opts: { bookingId?: string; imagesOnly?: boolean } = {},
) {
  if (!file || file.size === 0) throw new UploadError("Choose a file to upload");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("File is too large (max 5 MB)");
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = SIGNATURES.find((s) => s.test(bytes));
  if (!kind) throw new UploadError("Upload a JPG, PNG, WebP or PDF file");
  if (opts.imagesOnly && !kind.mime.startsWith("image/")) throw new UploadError("Upload a photo (JPG, PNG or WebP)");
  const storageKey = `${randomBytes(16).toString("hex")}.${kind.ext}`;
  await putBytes(storageKey, bytes, kind.mime);
  return db.storedFile.create({
    data: {
      ownerId,
      bookingId: opts.bookingId ?? null,
      filename: (file.name || `upload.${kind.ext}`).slice(0, 200),
      mimeType: kind.mime,
      size: bytes.length,
      storageKey,
    },
  });
}

/** Files from a multi-file <input>; ignores the empty entry browsers send when nothing is picked. */
export function filesFrom(formData: FormData, name: string): File[] {
  return formData.getAll(name).filter((v): v is File => typeof v !== "string" && v.size > 0);
}
