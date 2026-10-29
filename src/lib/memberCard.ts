/**
 * The member's membership card, drawn on a canvas so the preview on screen is the
 * exact file that is downloaded. Credit-card size (85.6 × 54 mm), 600 dpi.
 */

export interface MemberCardData {
  name: string;
  district: string;
  area: string;
  /** DD/MM/YYYY, or empty when not on record. */
  dateOfBirth: string;
  phone: string;
  photo: Blob | null;
}

export const CARD_MM = { width: 85.6, height: 54 } as const;

// Layout units; the canvas is SCALE times larger for print sharpness.
const W = 1012;
const H = 638;
const SCALE = 2;
const PAD = 48;

const RED = "#ef4444";
const RED_DEEP = "#c62f24";
const INK = "#111827";
const TEXT = "#1f2937";
const MUTED = "#9ca3af";
const FONT = '"Segoe UI Variable Text", "Aptos", "Segoe UI", Roboto, "Noto Sans Malayalam", sans-serif';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

async function loadBlobImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function setSpacing(ctx: Ctx, px: number) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`;
}

/** Shrinks the font down to `min` to fit `maxWidth`, then cuts with an ellipsis. */
function fitText(ctx: Ctx, text: string, maxWidth: number, weight: number, size: number, min: number): string {
  let px = size;
  ctx.font = `${weight} ${px}px ${FONT}`;
  while (ctx.measureText(text).width > maxWidth && px > min) {
    px -= 1;
    ctx.font = `${weight} ${px}px ${FONT}`;
  }
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function drawPhoto(ctx: Ctx, photo: HTMLImageElement | null, name: string, x: number, y: number, w: number, h: number) {
  ctx.save();
  roundedRect(ctx, x, y, w, h, 24);
  ctx.clip();
  if (photo) {
    // object-fit: cover, biased up so faces are not cut at the top
    const scale = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (photo.naturalWidth - sw) / 2;
    const sy = Math.max(0, (photo.naturalHeight - sh) * 0.3);
    ctx.drawImage(photo, sx, sy, sw, sh, x, y, w, h);
  } else {
    ctx.fillStyle = "#fdecea";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = RED;
    ctx.font = `700 120px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.trim().charAt(0).toUpperCase() || "?", x + w / 2, y + h / 2 + 6);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  roundedRect(ctx, x, y, w, h, 24);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#f6cfca";
  ctx.stroke();
}

function drawField(ctx: Ctx, label: string, value: string, x: number, y: number, maxWidth: number) {
  ctx.fillStyle = MUTED;
  ctx.font = `600 17px ${FONT}`;
  setSpacing(ctx, 2);
  ctx.fillText(label.toUpperCase(), x, y);
  setSpacing(ctx, 0);
  ctx.fillStyle = value ? TEXT : MUTED;
  const text = fitText(ctx, value || "—", maxWidth, 600, 29, 20);
  ctx.fillText(text, x, y + 38);
}

/** "+919747100550" → "+91 97471 00550"; anything else is shown as stored. */
export function formatCardPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 10 ? digits : null;
  return local ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : phone;
}

export async function renderMemberCard(data: MemberCardData): Promise<HTMLCanvasElement> {
  // Canvas text uses fallback fonts silently if the web font is not loaded yet
  await Promise.all([
    document.fonts?.load(`700 46px "Noto Sans Malayalam"`).catch(() => undefined),
    document.fonts?.ready,
  ]);
  const [logo, photo] = await Promise.all([
    loadImage("/logo.png"),
    data.photo ? loadBlobImage(data.photo).catch(() => null) : Promise.resolve(null),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d") as Ctx | null;
  if (!ctx) throw new Error("Canvas is not supported");
  ctx.scale(SCALE, SCALE);

  // Card body
  roundedRect(ctx, 0, 0, W, H, 32);
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // The red dot of the logo, as a soft watermark
  ctx.fillStyle = "rgba(239, 68, 68, 0.06)";
  ctx.beginPath();
  ctx.arc(W - 70, H - 60, 250, 0, Math.PI * 2);
  ctx.fill();

  // Header: logo + title pill
  const logoH = 92;
  const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
  ctx.drawImage(logo, PAD, 38, logoW, logoH);

  ctx.font = `700 19px ${FONT}`;
  setSpacing(ctx, 3);
  const pill = "MEMBERSHIP CARD";
  const pillW = ctx.measureText(pill).width + 44;
  const pillX = W - PAD - pillW;
  roundedRect(ctx, pillX, 62, pillW, 44, 22);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(pill, pillX + 22, 85);
  ctx.textBaseline = "alphabetic";
  setSpacing(ctx, 0);

  const band = ctx.createLinearGradient(0, 0, W, 0);
  band.addColorStop(0, RED);
  band.addColorStop(1, RED_DEEP);
  ctx.fillStyle = band;
  ctx.fillRect(0, 158, W, 8);

  // Photo
  drawPhoto(ctx, photo, data.name, PAD, 204, 232, 304);

  // Details — long names shrink a long way before they are cut
  const textX = PAD + 232 + 40;
  const textW = W - PAD - textX;
  ctx.fillStyle = INK;
  ctx.fillText(fitText(ctx, data.name, textW, 700, 46, 24), textX, 248);

  drawField(ctx, "District", data.district, textX, 310, textW);
  drawField(ctx, "Area", data.area, textX, 386, textW);
  const half = (textW - 24) / 2;
  drawField(ctx, "Date of Birth", data.dateOfBirth, textX, 462, half);
  drawField(ctx, "Mobile", formatCardPhone(data.phone), textX + half + 24, 462, half);

  // Footer band
  ctx.fillStyle = band;
  ctx.fillRect(0, H - 72, W, 72);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 19px ${FONT}`;
  setSpacing(ctx, 3);
  ctx.textBaseline = "middle";
  ctx.fillText("SOLIDARITY YOUTH MOVEMENT KERALA", PAD, H - 36);
  setSpacing(ctx, 0);
  ctx.font = `500 19px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("solidarityym.org", W - PAD, H - 36);

  return canvas;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image"))), "image/png");
  });
}

export function memberCardFileName(name: string, ext: "png" | "pdf"): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member";
  return `solidarity-member-card-${slug}.${ext}`;
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before the URL goes away
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A one-page PDF the exact size of the card, ready for a print shop. */
export async function memberCardPdf(canvas: HTMLCanvasElement): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  // jsPDF keeps a transparent PNG uncompressed (~10 MB); a JPEG on white is a few hundred KB
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [CARD_MM.width, CARD_MM.height] });
  doc.addImage(flat.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, CARD_MM.width, CARD_MM.height);
  return doc.output("blob");
}
