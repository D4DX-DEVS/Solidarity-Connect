import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useNavigation, type CaptionProps } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dateToIso, dobToIso, formatDobInput, isoToDate, isoToDob } from "@/lib/dob";
import { cn } from "@/lib/utils";

interface DateOfBirthInputProps {
  id?: string;
  /** "YYYY-MM-DD", or "" when not set. */
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  className?: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FIRST_YEAR = 1940;
// Opens here when there is no date yet — most members were born around then
const DEFAULT_MONTH = new Date(1995, 0, 1);

/** Month and year pickers in the app's own dropdowns, so a birth year is two taps away. */
function MonthYearCaption({ displayMonth }: CaptionProps) {
  const { goToMonth } = useNavigation();
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => thisYear - i);
  return (
    <div className="flex items-center justify-center gap-2 pt-1">
      <Select value={String(displayMonth.getMonth())} onValueChange={(m) => goToMonth(new Date(displayMonth.getFullYear(), Number(m), 1))}>
        <SelectTrigger aria-label="Month" className="h-9 w-[7.5rem] text-sm"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-72">
          {MONTHS.map((name, i) => <SelectItem key={name} value={String(i)}>{name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={String(displayMonth.getFullYear())} onValueChange={(y) => goToMonth(new Date(Number(y), displayMonth.getMonth(), 1))}>
        <SelectTrigger aria-label="Year" className="h-9 w-[5.5rem] text-sm"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-72">
          {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Date of birth: type it as DD/MM/YYYY (slashes added as you go) or pick it from a
 * calendar with month and year dropdowns. Only a complete, real, past date reaches
 * `onChange`; clearing the box sends "".
 */
export function DateOfBirthInput({ id, value, onChange, disabled, className }: DateOfBirthInputProps) {
  const [text, setText] = useState(isoToDob(value));
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  // A new value from outside (form loaded, calendar pick) replaces what is typed
  useEffect(() => {
    setText((current) => (dobToIso(current) === value ? current : isoToDob(value)));
  }, [value]);

  const typed = (raw: string) => {
    const next = formatDobInput(raw);
    setText(next);
    const iso = dobToIso(next);
    if (iso) onChange(iso);
    else if (!next) onChange("");
  };

  const unfinished = text !== "" && !dobToIso(text);
  const showError = unfinished && (touched || text.length === 10);
  const errorId = id ? `${id}-error` : undefined;
  const selected = isoToDate(value);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          placeholder="DD/MM/YYYY"
          value={text}
          maxLength={10}
          disabled={disabled}
          onChange={(e) => typed(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          className="pr-12"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label="Pick date of birth from a calendar"
              className="absolute right-1 top-1/2 size-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <CalendarDays className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected ?? DEFAULT_MONTH}
              fromYear={FIRST_YEAR}
              toDate={new Date()}
              disabled={{ after: new Date() }}
              components={{ Caption: MonthYearCaption }}
              onSelect={(date) => {
                if (!date) return;
                onChange(dateToIso(date));
                setText(isoToDob(dateToIso(date)));
                setTouched(false);
                setOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      {showError ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">Enter a full, real date as DD/MM/YYYY.</p>
      ) : null}
    </div>
  );
}
