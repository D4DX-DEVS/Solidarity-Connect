import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Download, FileText, Loader2, Upload } from "lucide-react";
import { ErrorState } from "@/components/shared/StateMessage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLatest } from "@/hooks/useLatest";
import { useToast } from "@/hooks/use-toast";
import { isoToDob } from "@/lib/dob";
import { canvasToPng, memberCardFileName, memberCardPdf, renderMemberCard, saveBlob } from "@/lib/memberCard";

export interface MemberCardProfile {
  name: string;
  phone: string;
  avatar?: string | null;
  dateOfBirth?: string;
  district?: { name: string } | null;
  group?: { name: string } | null;
}

interface MemberCardViewProps {
  profile: MemberCardProfile;
  /** The photo as image bytes (served by our API — the bucket sends no CORS headers). */
  loadPhoto: () => Promise<Blob | null>;
  /** Only for the member's own card: lets them add or change the photo right here. */
  photoUpload?: { uploading: boolean; onSelected: (file: File) => Promise<void> | void };
}

type CardState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; canvas: HTMLCanvasElement; previewUrl: string; photoMissing: boolean };

/**
 * The membership card on its own — no surrounding card or frame, so it reads as the
 * card itself — with PNG / PDF download. Wording follows whose card it is.
 */
export function MemberCardView({ profile, loadPhoto, photoUpload }: MemberCardViewProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const loadPhotoRef = useLatest(loadPhoto);
  const [card, setCard] = useState<CardState>({ status: "loading" });
  const [saving, setSaving] = useState<"png" | "pdf" | null>(null);
  const [attempt, setAttempt] = useState(0);

  const own = !!photoUpload;
  const { name, phone, avatar, dateOfBirth } = profile;
  const district = profile.district?.name ?? "";
  const area = profile.group?.name ?? "";

  useEffect(() => {
    let cancelled = false;
    let previewUrl: string | null = null;
    setCard({ status: "loading" });

    (async () => {
      // A photo that will not load still gives a card — with the initial in its place
      const photo = avatar ? await loadPhotoRef.current().catch(() => null) : null;
      const canvas = await renderMemberCard({ name, phone, district, area, dateOfBirth: isoToDob(dateOfBirth), photo });
      const png = await canvasToPng(canvas);
      if (cancelled) return;
      previewUrl = URL.createObjectURL(png);
      setCard({ status: "ready", canvas, previewUrl, photoMissing: !photo });
    })().catch(() => {
      if (!cancelled) setCard({ status: "error" });
    });

    return () => {
      cancelled = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [name, phone, avatar, dateOfBirth, district, area, attempt, loadPhotoRef]);

  const download = useCallback(async (format: "png" | "pdf") => {
    if (card.status !== "ready") return;
    setSaving(format);
    try {
      const blob = format === "png" ? await canvasToPng(card.canvas) : await memberCardPdf(card.canvas);
      saveBlob(blob, memberCardFileName(name, format));
      toast({ title: "Card downloaded", description: format === "png" ? "Saved as an image." : "Saved as a PDF." });
    } catch {
      toast({ title: "Error", description: "Could not create the card file. Please try again.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }, [card, name, toast]);

  const ready = card.status === "ready";
  const pickPhoto = () => fileRef.current?.click();

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      {photoUpload && (
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileRef}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await photoUpload.onSelected(file);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
      )}

      {card.status === "loading" ? (
        <Skeleton className="aspect-[1012/638] w-full rounded-[1.25rem]" />
      ) : card.status === "error" ? (
        <ErrorState message="Could not make the card." onRetry={() => setAttempt((n) => n + 1)} />
      ) : (
        <img
          src={card.previewUrl}
          alt={`Membership card of ${name}`}
          className="w-full rounded-[1.25rem] shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)]"
        />
      )}

      {ready && card.photoMissing && (avatar || own) && (
        <div className="flex flex-col gap-3 rounded-xl bg-primary/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            {avatar
              ? `The photo could not be loaded, so the card shows ${own ? "your" : "their"} initial.`
              : "Add your photo so it appears on your card."}
          </p>
          <Button
            size="sm"
            className="min-h-11 shrink-0 gap-2 sm:min-h-9"
            disabled={photoUpload?.uploading}
            onClick={() => (avatar ? setAttempt((n) => n + 1) : pickPhoto())}
          >
            {photoUpload?.uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {avatar ? "Try again" : photoUpload?.uploading ? "Uploading..." : "Add Photo"}
          </Button>
        </div>
      )}

      {ready && !avatar && !own && (
        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          No profile photo yet, so the card shows their initial. Members add their photo from their own login.
        </p>
      )}

      {ready && !dateOfBirth && (
        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          {own ? "Your date of birth is not on record yet. Ask your area admin to add it." : "Date of birth is not on record, so the card shows a dash."}
        </p>
      )}

      <div className={`grid grid-cols-2 gap-2 ${photoUpload && avatar ? "sm:grid-cols-3" : ""}`}>
        <Button className="min-h-11 gap-2" disabled={!ready || saving !== null} onClick={() => download("png")}>
          {saving === "png" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Image
        </Button>
        <Button variant="outline" className="min-h-11 gap-2" disabled={!ready || saving !== null} onClick={() => download("pdf")}>
          {saving === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          PDF
        </Button>
        {/* Without a photo the prompt above offers Add Photo */}
        {photoUpload && avatar && (
          <Button
            variant="outline"
            className="col-span-2 min-h-11 gap-2 sm:col-span-1"
            disabled={photoUpload.uploading}
            onClick={pickPhoto}
          >
            {photoUpload.uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {photoUpload.uploading ? "Uploading..." : "Change Photo"}
          </Button>
        )}
      </div>
    </div>
  );
}
