import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageSizeInput from "@/components/app/PageSizeInput";
import { cn } from "@/lib/utils";

interface DataPaginationProps {
  page: number;
  pageSize: number;
  totalPages: number;
  totalDocs: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Plural noun for the result count, e.g. "areas". */
  itemLabel?: string;
  /** Disables Previous/Next while a page is loading. */
  disabled?: boolean;
  className?: string;
}

/** Shared list footer: result range, rows per page, Previous/Next. */
function DataPagination({
  page,
  pageSize,
  totalPages,
  totalDocs,
  onPageChange,
  onPageSizeChange,
  itemLabel = "results",
  disabled = false,
  className,
}: DataPaginationProps) {
  // A delete or a narrower filter can leave the URL pointing past the last page
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) onPageChange(totalPages);
  }, [page, totalPages, onPageChange]);

  if (totalDocs === 0) return null;

  const from = Math.min(totalDocs, (page - 1) * pageSize + 1);
  const to = Math.min(totalDocs, page * pageSize);

  return (
    <div
      className={cn(
        "data-strip flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground sm:text-sm",
        className,
      )}
    >
      <span className="min-w-0 tabular-nums">
        Showing {from}–{to} of {totalDocs} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        {/* key remounts the field when the size changes from the URL (back/forward) */}
        <PageSizeInput key={pageSize} value={pageSize} onChange={onPageSizeChange} />
        {totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-9 sm:w-9"
              onClick={() => onPageChange(page - 1)}
              disabled={disabled || page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-20 text-center tabular-nums" aria-live="polite">
              Page {Math.min(page, totalPages)} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-9 sm:w-9"
              onClick={() => onPageChange(page + 1)}
              disabled={disabled || page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}

export default DataPagination;
