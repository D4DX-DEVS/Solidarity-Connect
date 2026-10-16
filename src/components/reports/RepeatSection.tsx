import { useId, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { confirmAction } from "@/lib/confirm";
import { undoableDelete } from "@/lib/undoDelete";
import { ReportFieldInput } from "./ReportFieldInput";
import { UnitNamePicker } from "./UnitNamePicker";
import {
  MAX_ENTRIES, answerKey, entryTotals, errorKey, formatAnswer, isEmptyAnswer, isEntryFieldVisible, itemLabelOf,
  type Answers, type RepeatEntry, type ReportErrors, type ReportField,
} from "@/lib/reportForm";

interface RepeatSectionProps {
  heading: ReportField;
  /** The questions asked once per entry. */
  fields: ReportField[];
  answers: Answers;
  entries: RepeatEntry[];
  /** Omit for a read-only table of the entries. */
  onEntriesChange?: (entries: RepeatEntry[]) => void;
  errors?: ReportErrors;
  disabled?: boolean;
  /** Units to offer in the picker (area's member records + units named in earlier reports). */
  suggestions?: string[];
}

const GRID = "grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4";

/** A section filled once per named entry (an area's units), with + Add and the running totals. */
export function RepeatSection({ heading, fields, answers, entries, onEntriesChange, errors = {}, disabled, suggestions = [] }: RepeatSectionProps) {
  const listId = useId();
  const item = itemLabelOf(heading);
  const totals = entryTotals(fields, answers, entries);
  const numberFields = fields.filter(f => f.type === "number");
  // Undo runs ~10s later — it must add back into the list as it is then, not as it was.
  const latest = useRef({ entries, onEntriesChange });
  latest.current = { entries, onEntriesChange };

  if (!onEntriesChange) return <EntriesTable item={item} fields={fields} answers={answers} entries={entries} totals={totals} />;

  const update = (index: number, patch: Partial<RepeatEntry>) =>
    onEntriesChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  const remove = async (index: number) => {
    const removed = entries[index];
    const label = removed.name.trim() || `${item} ${index + 1}`;
    const blank = !removed.name.trim() && fields.every(f => isEmptyAnswer(removed[answerKey(f.id)]));
    if (!blank) {
      const confirmed = await confirmAction({
        title: `Remove this ${item.toLowerCase()}?`,
        description: "Its numbers come off the totals when you save.",
        itemName: label,
        confirmLabel: "Remove",
        undoable: true,
      });
      if (!confirmed) return;
    }
    // Index from the current list: confirming takes time, the list may have changed
    const at = latest.current.entries.indexOf(removed);
    if (at === -1) return;
    onEntriesChange(latest.current.entries.filter((_, i) => i !== at));
    if (blank) return;
    undoableDelete({
      title: `${item} removed`,
      description: label,
      onRestore: () => {
        const { entries: now, onEntriesChange: commit } = latest.current;
        commit?.([...now.slice(0, at), removed, ...now.slice(at)]);
      },
    });
  };

  const sectionError = errors[errorKey(heading.id)];

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => {
        const nameId = `${listId}-name-${i}`;
        const nameError = errors[errorKey(heading.id, i)];
        return (
          <div key={i} className="space-y-4 rounded-xl border bg-muted/20 p-3 sm:p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor={nameId} className="text-sm font-medium">
                  {item} {i + 1} name<span className="ml-0.5 text-destructive" aria-hidden>*</span>
                </Label>
                <UnitNamePicker
                  id={nameId}
                  value={entry.name}
                  onChange={(name) => update(i, { name })}
                  suggestions={suggestions}
                  taken={entries.filter((_, j) => j !== i).map(e => e.name)}
                  item={item}
                  invalid={Boolean(nameError)}
                  describedBy={nameError ? `${nameId}-error` : undefined}
                  disabled={disabled}
                />
                {nameError ? <p id={`${nameId}-error`} role="alert" className="text-xs font-medium text-destructive">{nameError}</p> : null}
              </div>
              {entries.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-7 size-11 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${entry.name.trim() || `${item} ${i + 1}`}`}
                  disabled={disabled}
                  onClick={() => void remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>

            <div className={GRID}>
              {fields.filter(f => isEntryFieldVisible(f, answers, entry)).map(field => (
                <ReportFieldInput
                  key={field.id}
                  field={field}
                  idSuffix={`-${heading.id}-${i}`}
                  value={entry[answerKey(field.id)]}
                  error={errors[errorKey(field.id, i)]}
                  disabled={disabled}
                  onChange={(next) => update(i, { [answerKey(field.id)]: next })}
                  className="row-span-3 grid-rows-subgrid"
                />
              ))}
            </div>
          </div>
        );
      })}

      {sectionError ? <p role="alert" className="text-xs font-medium text-destructive">{sectionError}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 gap-2 self-start"
          disabled={disabled || entries.length >= MAX_ENTRIES}
          onClick={() => onEntriesChange([...entries, { name: "" }])}
        >
          <Plus className="size-4" />
          Add {item.toLowerCase()}
        </Button>
        {numberFields.length ? (
          <p className="text-xs text-muted-foreground sm:text-right" aria-live="polite">
            <span className="font-medium text-foreground">Total of {entries.length} {entries.length === 1 ? item.toLowerCase() : `${item.toLowerCase()}s`}:</span>{" "}
            {numberFields.map(f => `${f.label} ${totals.get(f.id) ?? 0}`).join(" · ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface EntriesTableProps {
  item: string;
  fields: ReportField[];
  answers: Answers;
  entries: RepeatEntry[];
  totals: Map<number, number>;
}

/** Read-only: one row per entry, a column per question, totals at the foot. */
function EntriesTable({ item, fields, answers, entries, totals }: EntriesTableProps) {
  const hasNumbers = fields.some(f => f.type === "number");
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">{item}</th>
            {fields.map(f => (
              <th key={f.id} scope="col" className={`px-3 py-2 font-medium ${f.type === "number" ? "text-right" : "text-left"}`}>{f.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={i} className="border-t">
              <th scope="row" className="px-3 py-2 text-left font-medium">{entry.name || `${item} ${i + 1}`}</th>
              {fields.map(f => (
                <td key={f.id} className={`px-3 py-2 ${f.type === "number" ? "text-right tabular-nums" : ""}`}>
                  {isEntryFieldVisible(f, answers, entry) ? formatAnswer(f, entry[answerKey(f.id)]) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasNumbers ? (
          <tfoot className="border-t bg-muted/20 font-semibold">
            <tr>
              <th scope="row" className="px-3 py-2 text-left">Total</th>
              {fields.map(f => (
                <td key={f.id} className="px-3 py-2 text-right tabular-nums">{f.type === "number" ? totals.get(f.id) ?? 0 : ""}</td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
