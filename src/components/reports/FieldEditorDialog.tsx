import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CHOICE_TYPES, FIELD_TYPE_LABELS, OPERATOR_LABELS, VALUELESS_OPERATORS,
  type ConditionOperator, type FieldType, type ReportField,
} from "@/lib/reportForm";

interface FieldEditorDialogProps {
  field: ReportField | null;
  /** Questions before this one — the only ones a show/hide rule may use. */
  earlierFields: ReportField[];
  onSave: (field: ReportField) => void;
  onClose: () => void;
}

const TYPE_ORDER = Object.keys(FIELD_TYPE_LABELS) as FieldType[];
const OPERATORS = Object.keys(OPERATOR_LABELS) as ConditionOperator[];

/** Switching type drops the settings the new type cannot use. */
function retype(field: ReportField, type: FieldType): ReportField {
  const { id, label, helpText, condition } = field;
  const next: ReportField = { id, type, label, helpText, condition };
  if (type === "heading") return { ...next, condition: undefined };
  next.required = field.required ?? false;
  if (CHOICE_TYPES.includes(type)) next.options = field.options?.length ? field.options : [];
  if (type === "number") next.sum = field.sum ?? true;
  return next;
}

const numberOrUndefined = (value: string) => (value.trim() === "" ? undefined : Number(value));

function problems(field: ReportField): string | null {
  if (!field.label.trim()) return "Add a label";
  if (CHOICE_TYPES.includes(field.type) && !(field.options || []).some(o => o.trim())) return "Add at least one option";
  if (field.min !== undefined && field.max !== undefined && field.min > field.max) return "Min is greater than max";
  if ([field.min, field.max, field.maxLength].some(v => v !== undefined && !Number.isFinite(v))) return "Limits must be numbers";
  const c = field.condition;
  if (c && !VALUELESS_OPERATORS.includes(c.operator) && !String(c.value ?? "").trim()) return "The show/hide rule needs a value";
  return null;
}

/** Edit one question: label, type, help, required, options, limits, add-up and show/hide rule. */
export function FieldEditorDialog({ field, earlierFields, onSave, onClose }: FieldEditorDialogProps) {
  const [draft, setDraft] = useState<ReportField | null>(field);
  const [optionsText, setOptionsText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(field);
    setOptionsText((field?.options || []).join("\n"));
    setError(null);
  }, [field]);

  if (!draft) return null;
  const set = (patch: Partial<ReportField>) => setDraft({ ...draft, ...patch });
  const conditionTargets = earlierFields.filter(f => f.type !== "heading");
  const target = conditionTargets.find(f => f.id === draft.condition?.fieldId);
  const targetChoices = target?.type === "yesno" ? ["yes", "no"] : target && CHOICE_TYPES.includes(target.type) ? target.options || [] : null;

  const save = () => {
    const options = CHOICE_TYPES.includes(draft.type)
      ? [...new Set(optionsText.split("\n").map(o => o.trim()).filter(Boolean))]
      : undefined;
    const cleaned: ReportField = { ...draft, label: draft.label.trim(), options };
    const problem = problems(cleaned);
    if (problem) {
      setError(problem);
      return;
    }
    onSave(cleaned);
  };

  return (
    <Dialog open={Boolean(field)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit question</DialogTitle>
          <DialogDescription>Changes apply after you save the draft and publish.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fe-type">Type</Label>
            <Select value={draft.type} onValueChange={(t) => setDraft(retype(draft, t as FieldType))}>
              <SelectTrigger id="fe-type" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPE_ORDER.map(t => <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fe-label">{draft.type === "heading" ? "Heading" : "Question"}</Label>
            <Input id="fe-label" className="h-11" value={draft.label} onChange={(e) => set({ label: e.target.value })} maxLength={300} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fe-help">Help text (optional)</Label>
            <Textarea id="fe-help" rows={2} value={draft.helpText || ""} onChange={(e) => set({ helpText: e.target.value })} maxLength={500} />
          </div>

          {draft.type !== "heading" ? (
            <>
              <ToggleRow id="fe-required" label="Required" checked={Boolean(draft.required)} onChange={(v) => set({ required: v })} />

              {CHOICE_TYPES.includes(draft.type) ? (
                <div className="space-y-1.5">
                  <Label htmlFor="fe-options">Options (one per line)</Label>
                  <Textarea id="fe-options" rows={4} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
                </div>
              ) : null}

              {draft.type === "number" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput id="fe-min" label="Minimum" value={draft.min} onChange={(v) => set({ min: v })} />
                    <NumberInput id="fe-max" label="Maximum" value={draft.max} onChange={(v) => set({ max: v })} />
                  </div>
                  <ToggleRow id="fe-decimal" label="Allow decimals" checked={Boolean(draft.allowDecimal)} onChange={(v) => set({ allowDecimal: v })} />
                  <ToggleRow
                    id="fe-sum"
                    label="Add up"
                    hint="Total it from areas to districts to the state, and show it to members."
                    checked={draft.sum !== false}
                    onChange={(v) => set({ sum: v })}
                  />
                </>
              ) : null}

              {draft.type === "text" || draft.type === "textarea" ? (
                <NumberInput id="fe-maxlength" label="Maximum length (optional)" value={draft.maxLength} onChange={(v) => set({ maxLength: v })} />
              ) : null}

              {["text", "textarea", "number", "phone", "email", "select"].includes(draft.type) ? (
                <div className="space-y-1.5">
                  <Label htmlFor="fe-placeholder">Placeholder (optional)</Label>
                  <Input id="fe-placeholder" className="h-11" value={draft.placeholder || ""} onChange={(e) => set({ placeholder: e.target.value })} maxLength={200} />
                </div>
              ) : null}

              <div className="space-y-3 rounded-lg border p-3">
                <ToggleRow
                  id="fe-condition"
                  label="Show only when…"
                  hint={conditionTargets.length === 0 ? "Add a question above this one to use a rule." : "Hide this question unless an earlier answer matches."}
                  checked={Boolean(draft.condition)}
                  disabled={conditionTargets.length === 0}
                  onChange={(on) => set({ condition: on ? { fieldId: conditionTargets[conditionTargets.length - 1].id, operator: "is_not_empty" } : undefined })}
                />
                {draft.condition ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Select value={String(draft.condition.fieldId)} onValueChange={(v) => set({ condition: { fieldId: Number(v), operator: draft.condition!.operator } })}>
                      <SelectTrigger aria-label="Question" className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>{conditionTargets.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={draft.condition.operator} onValueChange={(v) => set({ condition: { ...draft.condition!, operator: v as ConditionOperator } })}>
                      <SelectTrigger aria-label="Rule" className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>{OPERATORS.map(o => <SelectItem key={o} value={o}>{OPERATOR_LABELS[o]}</SelectItem>)}</SelectContent>
                    </Select>
                    {VALUELESS_OPERATORS.includes(draft.condition.operator) ? null : targetChoices ? (
                      <Select value={draft.condition.value || ""} onValueChange={(v) => set({ condition: { ...draft.condition!, value: v } })}>
                        <SelectTrigger aria-label="Value" className="h-11"><SelectValue placeholder="Value" /></SelectTrigger>
                        <SelectContent>{targetChoices.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input
                        aria-label="Value"
                        className="h-11"
                        type={target?.type === "number" ? "number" : "text"}
                        value={draft.condition.value || ""}
                        onChange={(e) => set({ condition: { ...draft.condition!, value: e.target.value } })}
                      />
                    )}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="min-h-11">Cancel</Button>
          <Button onClick={save} className="min-h-11">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ id, label, hint, checked, onChange, disabled }: {
  id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function NumberInput({ id, label, value, onChange }: { id: string; label: string; value?: number; onChange: (v?: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" className="h-11" value={value ?? ""} onChange={(e) => onChange(numberOrUndefined(e.target.value))} />
    </div>
  );
}
