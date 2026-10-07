import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, Users, Phone, Home } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import { EmptyState, ErrorState } from "@/components/shared/StateMessage";
import DataPagination from "@/components/app/DataPagination";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { memberAuthAPI } from "@/utils/api";

interface DirectoryMember {
  _id: string;
  name: string;
  phone: string;
  status: string;
  address?: string; // unit name
  avatar?: string | null;
  isLeader?: boolean;
  roleTag?: { type?: string; name?: string } | null;
  district?: { _id: string; name: string } | null;
  group?: { _id: string; name: string } | null;
}

interface Place {
  _id: string;
  name: string;
}

// Mirrors DIRECTORY_STATUSES in the API (member-auth /members)
const STATUSES = ["Active", "Applicant", "Inactive", "Abroad"];

// District / area / status pickers sit side by side, even on phones (same as Leaders)
const FILTER_TRIGGER_CLASS = "min-w-0 px-3 text-left text-xs sm:px-4 sm:text-sm xl:w-48";

const STATUS_BADGE: Record<string, string> = {
  Applicant: "bg-orange-100 text-orange-800",
  Abroad: "bg-blue-100 text-blue-800",
  Inactive: "bg-gray-100 text-gray-800",
};

const ROLE_LABELS: Record<string, string> = {
  state: "State",
  district: "District",
  area: "Area",
  unit: "Unit",
  murabi: "Murabi",
  coordinator: "Coordinator",
};

/**
 * Read-only member directory for the member login: every current member,
 * org-wide, with search and district / area / status filters — no edits.
 */
const MemberDirectory = ({ embedded = false }: { embedded?: boolean }) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [district, setDistrict] = useState("");
  const [area, setArea] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // The API ignores terms under 2 characters, so don't send (or count) them
  useEffect(() => {
    const timer = setTimeout(() => {
      const term = search.trim();
      setDebouncedSearch(term.length >= 2 ? term : "");
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const params: Record<string, string | number> = {
    page,
    limit: pageSize,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(status ? { status } : {}),
    ...(district ? { district } : {}),
    ...(area ? { group: area } : {}),
  };

  const { data: districts = [] } = useQuery({
    queryKey: ["member-directory", "districts"],
    queryFn: async () => ((await memberAuthAPI.getDistricts()).data || []) as Place[],
  });

  // Areas narrow to the chosen district; with none chosen, every area is listed
  const { data: areas = [] } = useQuery({
    queryKey: ["member-directory", "areas", district || null],
    queryFn: async () =>
      ((await memberAuthAPI.getGroups(district ? { district } : undefined)).data || []) as Place[],
  });

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ["member-directory", params],
    queryFn: () => memberAuthAPI.getMembers(params),
    placeholderData: keepPreviousData,
  });

  const members: DirectoryMember[] = data?.data || [];
  const totalDocs: number = data?.pagination?.totalDocs ?? 0;
  const totalPages: number = data?.pagination?.totalPages ?? 1;
  const isFiltered = Boolean(debouncedSearch || status || district || area);

  const changeStatus = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const changeDistrict = (value: string) => {
    setDistrict(value);
    setArea("");
    setPage(1);
  };

  const changeArea = (value: string) => {
    setArea(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    changeStatus("");
    changeDistrict("");
  };

  const content = (
    <div className="space-y-3">
      {/* Search on its own row, the three pickers side by side below it
          (all on one line on wide screens) */}
      <div className="flex flex-col gap-2 xl:flex-row">
        <div className="relative min-w-0 xl:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, phone or unit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search members"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 xl:flex xl:shrink-0">
          <Select value={district || "all"} onValueChange={(value) => changeDistrict(value === "all" ? "" : value)}>
            <SelectTrigger className={FILTER_TRIGGER_CLASS} aria-label="Filter by district">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Districts</SelectItem>
              {districts.map((d) => (
                <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={area || "all"} onValueChange={(value) => changeArea(value === "all" ? "" : value)}>
            <SelectTrigger className={FILTER_TRIGGER_CLASS} aria-label="Filter by area">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Areas</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status || "all"} onValueChange={(value) => changeStatus(value === "all" ? "" : value)}>
            <SelectTrigger className={FILTER_TRIGGER_CLASS} aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isPending && (
        <p className="px-1 text-xs text-muted-foreground sm:text-sm">
          {totalDocs} member{totalDocs === 1 ? "" : "s"}
        </p>
      )}

      {isPending ? (
        <ListSkeleton rows={6} />
      ) : isError ? (
        <ErrorState message="Failed to load members" onRetry={() => refetch()} />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members found"
          description={isFiltered ? "Nobody matches these filters." : undefined}
          action={isFiltered ? <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => (
            <MemberCard key={member._id} member={member} />
          ))}
        </div>
      )}

      {/* Rows per page + Previous/Next at the bottom, same footer as the admin lists */}
      {!isPending && !isError && (
        <DataPagination
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          totalDocs={totalDocs}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          itemLabel="members"
          disabled={isFetching}
        />
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="app-page">
      <div className="app-page-orb app-page-orb-primary" aria-hidden />
      <div className="app-page-orb app-page-orb-secondary" aria-hidden />
      <HeaderWithLogout
        icon={<Users className="h-6 w-6 text-primary-foreground" />}
        title="Members"
        subtitle="All members"
      />
      <main className="app-main space-y-3 pt-4 pb-28 lg:pb-8">
        {content}
      </main>
    </div>
  );
};

const MemberCard = ({ member }: { member: DirectoryMember }) => {
  const area = member.group?.name;
  const district = member.district?.name;
  // Area · District (an area named after its district shows once)
  const place = [area, district !== area ? district : undefined].filter(Boolean).join(" · ");
  const roleType = member.isLeader ? member.roleTag?.type : undefined;

  return (
    <Card className="surface-card h-full p-2.5 sm:p-3">
      <div className="flex items-center gap-2.5">
        {member.avatar ? (
          <img src={member.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-border" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary" aria-hidden>
            {member.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold sm:text-base">{member.name}</h3>
            {member.status === "Active" ? (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" title="Active">
                <span className="sr-only">Active</span>
              </span>
            ) : (
              <Badge variant="secondary" className={`shrink-0 px-1.5 py-0 text-[10px] ${STATUS_BADGE[member.status] || ""}`}>
                {member.status}
              </Badge>
            )}
            {roleType && (
              <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] text-primary border-primary/40">
                {ROLE_LABELS[roleType] || roleType} leader
              </Badge>
            )}
          </div>
          {place && <p className="truncate text-xs text-muted-foreground">{place}</p>}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
        <a
          href={`tel:${member.phone}`}
          className="flex min-w-0 items-center gap-1.5 rounded-xl bg-primary/5 px-2 py-1.5 text-primary"
          aria-label={`Call ${member.name}`}
        >
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{member.phone}</span>
        </a>
        <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-muted/65 px-2 py-1.5 text-muted-foreground" title="Unit">
          <Home className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{member.address || "No unit"}</span>
        </div>
      </div>
    </Card>
  );
};

export default MemberDirectory;
