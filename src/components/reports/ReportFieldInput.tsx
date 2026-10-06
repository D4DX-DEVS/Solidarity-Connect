import { useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { uploadsAPI } from "@/utils/api";
import { cn } from "@/lib/utils";
import type { AnswerValue, FileAnswer, ReportField } from "@/lib/reportForm";

interface ReportFieldInputProps {
  field: ReportField;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  error?: string;
  disabled?: boolean;
}

const INPUT_TYPES: Partial<Record<ReportField["type"], string>> = {
  text: "text", date: "date", time: "time", phone: "tel", email: "email",
};

/** One question of a monthly report, as an editable control with its label, help and error. */
export function ReportFieldInput({ field, value, onChange, error, disabled }: ReportFieldInputProps) {
  const inputId = `report-field-${field.id}`;
  const describedBy = [field.helpText ? `${inputId}-help` : null, error ? `${inputId}-error` : null].filter(Boolean).join(" ") || undefined;
  const common = { id: inputId, disabled, "aria-invalid": Boolean(error), "aria-describedby": describedBy };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-sm font-medium leading-snug">
        {field.label}
        {field.required ? <span className="ml-0.5 text-destructive" aria-hidden>*</span> : null}
      </Label>
      {field.helpText ? <p id={`${inputId}-help`} className="text-xs text-muted-foreground">{field.helpText}</p> : null}

      <Control field={field} value={value} onChange={onChange} disabled={disabled} common={common} />

      {error ? <p id={`${inputId}-error`} role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

interface ControlProps {
  field: ReportField;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  disabled?: boolean;
  common: { id: string; disabled?: boolean; "aria-invalid": boolean; "aria-describedby"?: string };
}

function Control({ field, value, onChange, disabled, common }: ControlProps) {
  switch (field.type) {
    case "number":
      return (
        <Input
          {...common}
          type="number"
          inputMode={field.allowDecimal ? "decimal" : "numeric"}
          min={field.min}
          max={field.max}
          step={field.allowDecimal ? "any" : 1}
          placeholder={field.placeholder}
          value={value === null || value === undefined ? "" : String(value)}
          // Scrolling over a focused number input must not change the count.
          onWheel={(e) => (e.target as HTMLInputElement).blur()}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          className="h-11 max-w-[12rem] tabular-nums"
        />
      );
    case "textarea":
      return (
        <Textarea
          {...common}
          rows={4}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "yesno":
      return (
        <RadioGroup
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
          disabled={disabled}
          aria-labelledby={common.id}
          className="flex gap-3"
        >
          {[["yes", "Yes"], ["no", "No"]].map(([v, label]) => (
            <label key={v} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 has-[:checked]:border-primary">
              <RadioGroupItem value={v} id={`${common.id}-${v}`} />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </RadioGroup>
      );
    case "select":
      return (
        <Select value={typeof value === "string" ? value : ""} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={common.id} aria-invalid={common["aria-invalid"]} className="h-11">
            <SelectValue placeholder={field.placeholder || "Choose…"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case "radio":
      return (
        <RadioGroup value={typeof value === "string" ? value : ""} onValueChange={onChange} disabled={disabled} className="grid gap-1.5">
          {(field.options || []).map((o, i) => (
            <label key={o} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 has-[:checked]:border-primary">
              <RadioGroupItem value={o} id={`${common.id}-${i}`} />
              <span className="text-sm">{o}</span>
            </label>
          ))}
        </RadioGroup>
      );
    case "checkbox": {
      const picked = Array.isArray(value) ? value : [];
      return (
        <div className="grid gap-1.5">
          {(field.options || []).map((o, i) => (
            <label key={o} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3">
              <Checkbox
                id={`${common.id}-${i}`}
                checked={picked.includes(o)}
                disabled={disabled}
                onCheckedChange={(checked) => onChange(checked ? [...picked, o] : picked.filter(p => p !== o))}
              />
              <span className="text-sm">{o}</span>
            </label>
          ))}
        </div>
      );
    }
    case "file":
      return <FileControl value={value} onChange={onChange} disabled={disabled} id={common.id} />;
    default:
      return (
        <Input
          {...common}
          type={INPUT_TYPES[field.type] || "text"}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-11"
        />
      );
  }
}

function FileControl({ value, onChange, disabled, id }: { value: AnswerValue; onChange: (v: AnswerValue) => void; disabled?: boolean; id: string }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const file = value && typeof value === "object" && !Array.isArray(value) ? (value as FileAnswer) : null;

  const upload = async (picked?: File) => {
    if (!picked) return;
    setUploading(true);
    try {
      const result = await uploadsAPI.uploadFile(picked);
      const data = result.data as { url: string; originalName: string; mimetype: string; size: number };
      onChange({ url: data.url, name: data.originalName, mimetype: data.mimetype, size: data.size });
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (file) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-lg border px-3">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <a href={file.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-primary underline-offset-2 hover:underline">
          {file.name || "Uploaded file"}
        </a>
        {!disabled && (
          <Button type="button" variant="ghost" size="icon" aria-label="Remove file" onClick={() => onChange(null)}>
            <X className="size-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      <input ref={inputRef} id={id} type="file" className="sr-only" disabled={disabled || uploading} onChange={(e) => upload(e.target.files?.[0])} />
      <Button
        type="button"
        variant="outline"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className={cn("min-h-11 gap-2")}
      >
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {uploading ? "Uploading…" : "Upload file"}
      </Button>
    </div>
  );
}
