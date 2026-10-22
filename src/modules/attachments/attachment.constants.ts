import { extname } from "node:path";

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
] as const;

export type AllowedAttachmentMimeType =
  (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

export function isAllowedMimeType(
  mimeType: string,
): mimeType is AllowedAttachmentMimeType {
  return ALLOWED_ATTACHMENT_MIME_TYPES.includes(
    mimeType as AllowedAttachmentMimeType,
  );
}

const EXTENSIONS: Record<
  AllowedAttachmentMimeType,
  readonly [string, ...string[]]
> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "text/plain": [".txt"],
};

export function safeOriginalName(originalName: string): string {
  const normalized = originalName.replaceAll("\\", "/");
  const base = normalized.split("/").pop()?.trim() ?? "";
  const name = base.length > 0 ? base : "file";

  return name.slice(0, 255);
}

export function extensionForUpload(
  mimeType: AllowedAttachmentMimeType,
  originalName: string,
): string {
  const fromName = extname(safeOriginalName(originalName)).toLowerCase();
  const allowed = EXTENSIONS[mimeType];

  if (allowed.includes(fromName)) {
    return fromName;
  }

  return allowed[0];
}
