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
