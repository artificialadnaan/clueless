import { mkdirSync, existsSync, writeFileSync, createReadStream, statSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), "data.db");
const databaseDir = path.dirname(databasePath);
const imagesDir = process.env.IMAGES_DIR || path.join(databaseDir, "images");

if (!existsSync(imagesDir)) {
  mkdirSync(imagesDir, { recursive: true });
}

const ALLOWED_MIME = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/heic", ".heic"],
  ["image/gif", ".gif"],
]);

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime.toLowerCase());
}

export function saveImage(buffer: Buffer, mimeType: string): { filename: string } {
  const ext = ALLOWED_MIME.get(mimeType.toLowerCase()) || ".bin";
  const filename = `${crypto.randomUUID()}${ext}`;
  writeFileSync(path.join(imagesDir, filename), buffer);
  return { filename };
}

export function imageAbsolutePath(filename: string): string | null {
  // prevent path traversal
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) return null;
  const full = path.join(imagesDir, filename);
  if (!existsSync(full)) return null;
  return full;
}

export function imageContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

export function streamImage(filename: string) {
  const abs = imageAbsolutePath(filename);
  if (!abs) return null;
  const stat = statSync(abs);
  return {
    stream: createReadStream(abs),
    size: stat.size,
    contentType: imageContentType(filename),
  };
}
