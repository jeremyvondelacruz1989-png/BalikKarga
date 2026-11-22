import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

// Local-disk storage driver. To move to Supabase Storage or S3, reimplement
// putBytes/getBytes; everything else (metadata, access checks) stays the same.

const ROOT = path.resolve(process.env.UPLOAD_DIR || "./uploads");
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  { mime: "application/pdf", ext: "pdf", test: (b) => b.subarray(0, 5).toString() === "%PDF-" },
];

async function putBytes(key: string, bytes: Buffer) {
  await mkdir(ROOT, { recursive: true });
  await writeFile(path.join(ROOT, key), bytes);
}

export async function getBytes(key: string): Promise<Buffer> {
  if (!/^[a-zA-Z0-9_-]+\.[a-z]+$/.test(key)) throw new Error("Bad key");
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
  await putBytes(storageKey, bytes);
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
