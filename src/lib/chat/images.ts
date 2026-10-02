import { MAX_ATTACHMENTS, MAX_IMAGE_EDGE } from "./constants";
import type { Attachment } from "./types";

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export async function resizeImage(file: File): Promise<string> {
  const src = await readFile(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode that image"));
    el.src = src;
  });

  const longest = Math.max(img.width, img.height);
  const scale = longest > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / longest : 1;
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export async function fileToAttachment(file: File): Promise<Attachment> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be attached");
  }
  const dataUrl = await resizeImage(file);
  return {
    id: crypto.randomUUID(),
    name: file.name || "image",
    mime: "image/jpeg",
    dataUrl,
  };
}

export async function filesToAttachments(
  files: File[],
  existingCount: number,
): Promise<Attachment[]> {
  const room = Math.max(0, MAX_ATTACHMENTS - existingCount);
  const picked = files.filter((file) => file.type.startsWith("image/")).slice(0, room);
  const out: Attachment[] = [];
  for (const file of picked) {
    out.push(await fileToAttachment(file));
  }
  return out;
}
