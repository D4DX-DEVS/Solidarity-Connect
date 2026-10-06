import { Link } from "react-router-dom";
import { Cake, Home, MapPin, Phone, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatMemberRoles, type MemberRoleTag } from "@/lib/memberExport";

export interface ArchivedMember {
  _id: string;
  name: string;
  phone: string;
  address?: string; // unit name
  dateOfBirth?: string;
  /** Today's age from the API; null when archived by status without a DOB. */
  age: number | null;
  isLeader?: boolean;
  roleTag?: MemberRoleTag | null;
  extraRoleTags?: MemberRoleTag[];
  district?: { name: string; code: string } | null;
  group?: { name: string; code: string } | null;
}

// DOBs are stored at UTC midnight — format in UTC so the day never shifts.
const formatDob = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

const chip = "flex min-w-0 items-center gap-1.5 rounded-xl bg-muted/65 px-2 py-1 sm:gap-2 sm:px-2.5 sm:py-1.5";

export function ArchivedMemberCard({ member }: { member: ArchivedMember }) {
  const roles = formatMemberRoles(member);
  return (
    <Card className="surface-card relative transition-shadow duration-200 md:hover:-translate-y-0.5 md:hover:shadow-sm md:transition-all">
      <div className="p-2 sm:p-3">
        <div className="mb-1.5 flex min-w-0 items-center gap-2">
          {/* Stretched link: the whole card opens the profile, the phone link stays its own target */}
          <Link
            to={`/member/${member._id}`}
            className="truncate text-sm font-semibold after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring sm:text-base"
          >
            {member.name}
          </Link>
          <Badge variant="secondary" className="shrink-0 bg-amber-100 px-2 py-0 text-[11px] text-amber-800">
            Age over
          </Badge>
          {roles ? (
            <Badge variant="outline" className="hidden shrink-0 items-center gap-1 px-2 py-0 text-[11px] sm:inline-flex">
              <Star className="h-3 w-3" aria-hidden />
              Leader
            </Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground sm:gap-2 xl:grid-cols-5">
          <a href={`tel:${member.phone}`} className={`${chip} relative z-10 bg-primary/5 text-primary`}>
            <Phone className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            <span className="truncate">{member.phone}</span>
          </a>
          <div className={chip} title="Age">
            <Cake className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            <span className="truncate">
              {member.age !== null && member.dateOfBirth
                ? `${member.age} yrs · ${formatDob(member.dateOfBirth)}`
                : "Marked age over"}
            </span>
          </div>
          <div className={chip} title="Area">
            <Users className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            <span className="truncate">{member.group ? member.group.name : "No area"}</span>
          </div>
          <div className={chip} title="Unit">
            <Home className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            <span className="truncate">{member.address || "No unit"}</span>
          </div>
          <div className={`${chip} col-span-2 xl:col-span-1`} title="District">
            <MapPin className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            <span className="truncate">{member.district ? `${member.district.name} (${member.district.code})` : "No district"}</span>
          </div>
        </div>

        {roles ? <p className="mt-1.5 truncate text-xs text-muted-foreground" title={roles}>{roles}</p> : null}
      </div>
    </Card>
  );
}
