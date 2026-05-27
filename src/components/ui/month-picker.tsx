import * as React from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface MonthPickerProps {
  value: string; // "YYYY-MM" format
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function MonthPicker({ value, onChange, placeholder = "Select month", className }: MonthPickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse current value or default to current year
  const parsedYear = value ? parseInt(value.split("-")[0]) : new Date().getFullYear();
  const parsedMonth = value ? parseInt(value.split("-")[1]) - 1 : -1;
  const [viewYear, setViewYear] = React.useState(parsedYear);

  React.useEffect(() => {
    if (value) {
      setViewYear(parseInt(value.split("-")[0]));
    }
  }, [value]);

  const handleMonthSelect = (monthIndex: number) => {
    const monthStr = String(monthIndex + 1).padStart(2, "0");
    onChange(`${viewYear}-${monthStr}`);
    setOpen(false);
  };

  const displayValue = value
    ? `${MONTHS[parsedMonth]}, ${parsedYear}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-start text-left font-normal min-w-[140px]",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-3" align="start">
        {/* Year Navigation */}
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewYear(y => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{viewYear}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewYear(y => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Month Grid */}
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((month, index) => {
            const isSelected = parsedMonth === index && parsedYear === viewYear;
            const isCurrent =
              new Date().getMonth() === index &&
              new Date().getFullYear() === viewYear;

            return (
              <Button
                key={month}
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 text-xs",
                  isCurrent && !isSelected && "bg-accent text-accent-foreground",
                )}
                onClick={() => handleMonthSelect(index)}
              >
                {month}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

MonthPicker.displayName = "MonthPicker";

export { MonthPicker };
