import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface UnitNamePickerProps {
  id: string;
  value: string;
  onChange: (name: string) => void;
  /** Units known for this area (member records + units named in earlier reports). */
  suggestions: string[];
  /** Names already used by the other entries — offered but not pickable twice. */
  taken: string[];
  /** What one entry is called ("Unit"). */
  item: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

const tidy = (name: string) => name.trim().replace(/\s+/g, " ");

/** Pick a unit of the area, or type a new one and add it. */
export function UnitNamePicker({ id, value, onChange, suggestions, taken, item, invalid, describedBy, disabled }: UnitNamePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const noun = item.toLowerCase();

  const takenKeys = new Set(taken.map(t => tidy(t).toLowerCase()).filter(Boolean));
  // A name added by hand stays in the list while it is picked
  const known = [...suggestions];
  if (tidy(value) && !known.some(n => n.toLowerCase() === tidy(value).toLowerCase())) known.unshift(tidy(value));
  const query = tidy(search);
  const matches = query ? known.filter(n => n.toLowerCase().includes(query.toLowerCase())) : known;
  const canAdd = !!query && !known.some(n => n.toLowerCase() === query.toLowerCase()) && !takenKeys.has(query.toLowerCase());

  const pick = (name: string) => {
    onChange(name);
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between bg-background px-3 font-normal",
            invalid && "border-destructive",
          )}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || `Choose or add a ${noun}`}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search or type a new ${noun}…`}
            value={search}
            onValueChange={setSearch}
            maxLength={100}
          />
          <CommandList>
            <CommandEmpty>{query ? `"${query}" is already added.` : `No ${noun}s yet. Type a name to add one.`}</CommandEmpty>
            {canAdd ? (
              <CommandGroup>
                <CommandItem value={`add:${query}`} onSelect={() => pick(query)} className="gap-2 font-medium text-primary">
                  <Plus className="size-4" aria-hidden />
                  Add &ldquo;{query}&rdquo; as a new {noun}
                </CommandItem>
              </CommandGroup>
            ) : null}
            {matches.length ? (
              <CommandGroup heading={`${item}s in this area`}>
                {matches.map((name) => {
                  const selected = name.toLowerCase() === tidy(value).toLowerCase();
                  const used = !selected && takenKeys.has(name.toLowerCase());
                  return (
                    <CommandItem key={name} value={name} disabled={used} onSelect={() => pick(name)} className="gap-2">
                      <Check className={cn("size-4 shrink-0", selected ? "opacity-100" : "opacity-0")} aria-hidden />
                      <span className="truncate">{name}</span>
                      {used ? <span className="ml-auto text-xs text-muted-foreground">Added</span> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
