import { memberAuthAPI } from "@/utils/api";
import { MemberCardView, type MemberCardProfile } from "./MemberCardView";

interface MemberCardPanelProps {
  profile: MemberCardProfile;
  photoUploading: boolean;
  onPhotoSelected: (file: File) => Promise<void> | void;
}

/** Member portal: the signed-in member's own card, straight on the page (no frame around it). */
export function MemberCardPanel({ profile, photoUploading, onPhotoSelected }: MemberCardPanelProps) {
  return (
    <section className="space-y-4" aria-labelledby="member-card-heading">
      <div className="mx-auto w-full max-w-xl">
        {/* Desktop already shows the view name in the page header */}
        <h2 id="member-card-heading" className="text-base font-semibold lg:sr-only">Member Card</h2>
        <p className="text-sm text-muted-foreground">
          Made from your profile. Download it to keep on your phone or to print.
        </p>
      </div>
      <MemberCardView
        profile={profile}
        loadPhoto={memberAuthAPI.getCardPhoto}
        photoUpload={{ uploading: photoUploading, onSelected: onPhotoSelected }}
      />
    </section>
  );
}
