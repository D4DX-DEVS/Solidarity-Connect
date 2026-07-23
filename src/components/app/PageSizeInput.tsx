import { useState } from "react";
import { Input } from "@/components/ui/input";

interface PageSizeInputProps {
  value: number;
  onChange: (size: number) => void;
  className?: string;
}

/** Typeable rows-per-page field. Commits on Enter or blur; clamps to 1-100. */
function PageSizeInput({ value, onChange, className }: PageSizeInputProps) {
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n)) {
      const clamped = Math.min(100, Math.max(1, n));
      setDraft(String(clamped));
      if (clamped !== value) onChange(clamped);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <label className={`flex items-center gap-2 text-xs text-muted-foreground ${className || ""}`}>
      Rows
      <Input
        type="number"
        min={1}
        max={100}
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); } }}
        className="h-9 w-20 rounded-lg text-center text-sm"
        aria-label="Rows per page"
      />
    </label>
  );
}

export default PageSizeInput;
