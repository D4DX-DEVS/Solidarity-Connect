import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/mobile"; // members sign in with this number, so mobiles only
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Corridors we serve most; pinned above the full list (same as Login). */
const PINNED: CountryCode[] = ["IN", "AE", "SA", "QA", "KW", "OM", "BH", "MY", "SG", "GB", "US", "AU"];

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

const nameOf = (code: CountryCode) => regionNames?.of(code) ?? code;

const entry = (code: CountryCode) => ({
  code,
  name: nameOf(code),
  dial: getCountryCallingCode(code),
  search: `${nameOf(code)} ${code} +${getCountryCallingCode(code)}`,
});

const PINNED_COUNTRIES = PINNED.map(entry);
const OTHER_COUNTRIES = getCountries()
  .filter((code) => !PINNED.includes(code))
  .map(entry)
  .sort((a, b) => a.name.localeCompare(b.name));

type Parsed = NonNullable<ReturnType<typeof parsePhoneNumberFromString>>;

/**
 * Shared calling codes resolve to the territory (+44 7911… → Guernsey); prefer
 * the pinned country on that code so a UK number reads as GB.
 */
function countryOf(parsed: Parsed): CountryCode | undefined {
  if (!parsed.country || PINNED.includes(parsed.country)) return parsed.country;
  return PINNED.find((code) => getCountryCallingCode(code) === parsed.countryCallingCode) ?? parsed.country;
}

/** Stored numbers: +91XXXXXXXXXX, bare 10-digit Indian, or +country E.164. */
function parseStored(value: string): { country: CountryCode; national: string } {
  const trimmed = value.trim();
  if (!trimmed) return { country: "IN", national: "" };
  const parsed = parsePhoneNumberFromString(trimmed, "IN");
  const country = parsed && countryOf(parsed);
  if (parsed && country) return { country, national: parsed.nationalNumber };
  return { country: "IN", national: trimmed.replace(/\D/g, "") };
}

/**
 * Error for an E.164 value, or null when it can be saved. The server (and
 * sign-in) treats any 10-digit number as Indian, so foreign numbers need at
 * least 11 digits including the country code.
 */
export function phoneNumberError(value: string): string | null {
  if (!value) return "Phone number is required.";
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed || !isValidPhoneNumber(value)) {
    const country = parsed?.country ?? parseStored(value).country;
    return `Enter a valid mobile number for ${nameOf(country)}.`;
  }
  if (parsed.country !== "IN" && value.replace(/\D/g, "").length < 11) {
    return "This number is too short to save. Contact support for this country.";
  }
  return null;
}

interface PhoneNumberInputProps {
  id: string;
  /** E.164 (e.g. +919876543210), or "" when empty. */
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
}

/** Country code picker + national number. Emits E.164 so abroad members fit. */
export function PhoneNumberInput({ id, value, onChange, disabled }: PhoneNumberInputProps) {
  const [{ country, national }, setParts] = useState(() => parseStored(value));
  const [open, setOpen] = useState(false);
  const dial = getCountryCallingCode(country);

  // Edit page loads the member after mount; adopt the stored number once it arrives.
  useEffect(() => {
    const current = national ? `+${dial}${national}` : "";
    if (value !== current) setParts(parseStored(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (nextCountry: CountryCode, nextNational: string) => {
    setParts({ country: nextCountry, national: nextNational });
    onChange(nextNational ? `+${getCountryCallingCode(nextCountry)}${nextNational}` : "");
  };

  const error = national ? phoneNumberError(`+${dial}${national}`) : null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            type="button"
            aria-label="Country code"
            disabled={disabled}
            className="flex h-10 shrink-0 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {country} +{dial}
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[17rem] p-0">
            <Command>
              <CommandInput placeholder="Search country or code…" />
              <CommandList>
                <CommandEmpty>No country found.</CommandEmpty>
                {[
                  { heading: "Frequent", items: PINNED_COUNTRIES },
                  { heading: "All countries", items: OTHER_COUNTRIES },
                ].map((group) => (
                  <CommandGroup key={group.heading} heading={group.heading}>
                    {group.items.map((c) => (
                      <CommandItem
                        key={c.code}
                        value={c.search}
                        onSelect={() => {
                          emit(c.code, "");
                          setOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 size-4 shrink-0", c.code === country ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{c.name}</span>
                        <span className="ml-auto pl-2 text-muted-foreground">+{c.dial}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={country === "IN" ? "9876543210" : "Mobile number"}
          value={national}
          disabled={disabled}
          maxLength={15}
          aria-invalid={!!error}
          onChange={(e) => {
            const raw = e.target.value.trim();
            // A pasted +country number picks its own country.
            if (raw.startsWith("+")) {
              const parsed = parsePhoneNumberFromString(raw);
              const pasted = parsed && countryOf(parsed);
              if (parsed && pasted) {
                emit(pasted, parsed.nationalNumber);
                return;
              }
            }
            emit(country, raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 15));
          }}
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
