import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ExportFormat } from "@/lib/masterDataExport";

interface ExportMenuProps {
  /** Plural label used in the button title and toasts, e.g. "areas" */
  itemLabel: string;
  disabled?: boolean;
  /** Builds and downloads the file; resolves to the number of rows exported */
  onExport: (format: ExportFormat) => Promise<number>;
}

/** Download button with Excel / PDF choices, shared by the Master Data panels. */
const ExportMenu = ({ itemLabel, disabled = false, onExport }: ExportMenuProps) => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    if (exporting) return;
    setExporting(true);
    try {
      const count = await onExport(format);
      toast({
        title: "Exported",
        description: `${count} ${itemLabel} exported as ${format === "excel" ? "Excel" : "PDF"} file`,
      });
    } catch (error) {
      console.error(`Failed to export ${itemLabel}:`, error);
      toast({ title: "Error", description: `Failed to export ${itemLabel}`, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          disabled={disabled || exporting}
          aria-label={`Download ${itemLabel}`}
          title={`Download ${itemLabel}`}
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("excel")}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")}>PDF (.pdf)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportMenu;
