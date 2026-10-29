import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { IdCard } from "lucide-react";
import { PageHero, PageShell } from "@/components/app/AppShell";
import { MemberCardView } from "@/components/member-card/MemberCardView";
import { ErrorState } from "@/components/shared/StateMessage";
import { Skeleton } from "@/components/ui/skeleton";
import { membersAPI } from "@/utils/api";

/** Admins: download any member's membership card they are allowed to view. */
const MemberCardPage = () => {
  const { id } = useParams();
  // Same cache entry as the member detail page, so coming from there paints at once
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["members", "detail", id],
    queryFn: () => membersAPI.getMember(id!),
    enabled: !!id,
  });
  const member = data?.data ?? null;
  const loadPhoto = useCallback(() => membersAPI.getCardPhoto(id!), [id]);

  return (
    <PageShell>
      <PageHero
        backTo={`/member/${id}`}
        title="Member Card"
        subtitle={member ? member.name : "Membership card with photo and details, ready to download."}
        eyebrow="Members"
        icon={<IdCard className="h-6 w-6" />}
      />
      {isPending ? (
        <Skeleton className="mx-auto aspect-[1012/638] w-full max-w-xl rounded-[1.25rem]" />
      ) : isError || !member ? (
        <div className="mx-auto w-full max-w-xl">
          <ErrorState message="Could not load this member." onRetry={() => void refetch()} />
        </div>
      ) : (
        <MemberCardView profile={member} loadPhoto={loadPhoto} />
      )}
    </PageShell>
  );
};

export default MemberCardPage;
