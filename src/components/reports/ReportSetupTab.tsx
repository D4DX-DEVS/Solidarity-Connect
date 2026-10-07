import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Loader2, Pencil, Plus, Rocket, Save, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/shared/StateMessage";
import { useToast } from "@/hooks/use-toast";
import {
  FIELD_TYPE_LABELS, LEVEL_LABELS, OPERATOR_LABELS, VALUELESS_OPERATORS, formatDateTime,
  type Answers, type FieldType, type ReportField, type ReportLevel,
} from "@/lib/reportForm";
import { confirmAction } from "@/lib/confirm";
import { undoableDelete } from "@/lib/undoDelete";
import { monthlyReportService, type ReportFormDraft } from "@/services/monthlyReportService";
import { FieldEditorDialog } from "./FieldEditorDialog";
import { ReportFormView } from "./ReportFormView";

const LEVELS: ReportLevel[] = ["area", "district", "state"];
const ADDABLE = Object.keys(FIELD_TYPE_LABELS) as FieldType[];

interface Draft {
  title: string;
  deadlineDay: number;
  fields: ReportField[];
  nextFieldId: number;
}

const draftOf = (form: ReportFormDraft): Draft => ({
  title: form.title, deadlineDay: form.deadlineDay, fields: form.fields, nextFieldId: form.nextFieldId,
});

/** Drop show/hide rules that no longer point at an earlier question (after a move or delete). */
function keepValidConditions(fields: ReportField[]): { fields: ReportField[]; dropped: number } {
  const earlier = new Set<number>();
  let dropped = 0;
  const out = fields.map(f => {
    let next = f;
    if (f.condition && !earlier.has(f.condition.fieldId)) {
      next = { ...f, condition: undefined };
      dropped += 1;
    }
    if (f.type !== "heading") earlier.add(f.id);
    return next;
  });
  return { fields: out, dropped };
}

/** State admin: design the area, district and state monthly report forms. */
export function ReportSetupTab() {
  const { toast } = useToast();
  const [forms, setForms] = useState<Record<ReportLevel, ReportFormDraft> | null>(null);
  const [drafts, setDrafts] = useState<Record<ReportLevel, Draft> | null>(null);
  const [level, setLevel] = useState<ReportLevel>("area");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ReportField | null>(null);
  const [addType, setAddType] = useState<FieldType>("number");
  const [preview, setPreview] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await monthlyReportService.getForms();
      const byLevel = Object.fromEntries(list.map(f => [f.level, f])) as Record<ReportLevel, ReportFormDraft>;
      setForms(byLevel);
      setDrafts(Object.fromEntries(list.map(f => [f.level, draftOf(f)])) as Record<ReportLevel, Draft>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the forms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const form = forms?.[level];
  const draft = drafts?.[level];
  const unsaved = useMemo(() => Boolean(form && draft && JSON.stringify(draftOf(form)) !== JSON.stringify(draft)), [form, draft]);

  const update = (patch: Partial<Draft>) => drafts && draft && setDrafts({ ...drafts, [level]: { ...draft, ...patch } });

  const setFields = (fields: ReportField[], patch: Partial<Draft> = {}) => {
    const { fields: valid, dropped } = keepValidConditions(fields);
    if (dropped > 0) toast({ title: `${dropped} show/hide rule${dropped > 1 ? "s" : ""} removed`, description: "A rule can only use a question above it." });
    update({ ...patch, fields: valid });
  };

  const move = (index: number, by: -1 | 1) => {
    if (!draft) return;
    const fields = [...draft.fields];
    const [item] = fields.splice(index, 1);
    fields.splice(index + by, 0, item);
    setFields(fields);
  };

  const removeField = async (field: ReportField) => {
    if (!draft) return;
    const confirmed = await confirmAction({
      title: field.type === "heading" ? "Delete this section heading?" : "Delete this question?",
      description: "It leaves the draft now; the published form changes only when you publish.",
      itemName: field.label || "Untitled",
      undoable: true,
    });
    if (!confirmed) return;
    const formLevel = level;
    const index = draft.fields.findIndex(f => f.id === field.id);
    // Questions whose show/hide rule pointed at this one lose it; Undo gives it back.
    const dependents = new Map(draft.fields.filter(f => f.condition?.fieldId === field.id).map(f => [f.id, f.condition]));
    setFields(draft.fields.filter(f => f.id !== field.id));
    undoableDelete({
      title: field.type === "heading" ? "Heading deleted" : "Question deleted",
      description: field.label || undefined,
      onRestore: () => setDrafts(prev => {
        const current = prev?.[formLevel];
        if (!prev || !current || current.fields.some(f => f.id === field.id)) return prev;
        const fields = current.fields.map(f => (dependents.has(f.id) && !f.condition ? { ...f, condition: dependents.get(f.id) } : f));
        fields.splice(Math.min(index, fields.length), 0, field);
        return { ...prev, [formLevel]: { ...current, fields: keepValidConditions(fields).fields } };
      }),
    });
  };

  const addField = () => {
    if (!draft) return;
    const field: ReportField = addType === "heading"
      ? { id: draft.nextFieldId, type: "heading", label: "" }
      : { id: draft.nextFieldId, type: addType, label: "", required: addType === "number", ...(addType === "number" ? { sum: true, min: 0 } : {}) };
    setEditing(field);
  };

  const saveField = (field: ReportField) => {
    if (!draft) return;
    const exists = draft.fields.some(f => f.id === field.id);
    if (exists) setFields(draft.fields.map(f => (f.id === field.id ? field : f)));
    // A new question takes the counter's id; ids are never handed out twice.
    else setFields([...draft.fields, field], { nextFieldId: Math.max(draft.nextFieldId, field.id + 1) });
    setEditing(null);
  };

  const saveDraft = async (): Promise<boolean> => {
    if (!form || !draft) return false;
    setBusy("save");
    try {
      const saved = await monthlyReportService.saveForm(level, {
        fields: draft.fields, deadlineDay: draft.deadlineDay, title: draft.title, updatedAt: form.updatedAt,
      });
      setForms(prev => (prev ? { ...prev, [level]: saved } : prev));
      setDrafts(prev => (prev ? { ...prev, [level]: draftOf(saved) } : prev));
      toast({ title: "Draft saved", description: "Publish it when ready — admins keep the current version until then." });
      return true;
    } catch (e) {
      toast({ title: "Not saved", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (unsaved && !(await saveDraft())) return;
    setBusy("publish");
    try {
      const published = await monthlyReportService.publishForm(level);
      setForms(prev => (prev ? { ...prev, [level]: published } : prev));
      setDrafts(prev => (prev ? { ...prev, [level]: draftOf(published) } : prev));
      setConfirmPublish(false);
      toast({ title: `Published version ${published.version}`, description: `${LEVEL_LABELS[level]} admins now fill this form.` });
    } catch (e) {
      toast({ title: "Not published", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Skeleton className="h-96" />;
  if (error || !form || !draft) return <ErrorState message={error || "Could not load the forms"} onRetry={load} />;

  const labelOf = (id: number) => draft.fields.find(f => f.id === id)?.label || `Question ${id}`;
  const editingIndex = editing ? draft.fields.findIndex(f => f.id === editing.id) : -1;
  const earlierFields = editing ? (editingIndex === -1 ? draft.fields : draft.fields.slice(0, editingIndex)) : [];

  return (
    <div className="space-y-4">
      <Tabs value={level} onValueChange={(v) => { setLevel(v as ReportLevel); setPreview(false); setPreviewAnswers({}); }}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          {LEVELS.map(l => (
            <TabsTrigger key={l} value={l} className="min-h-10">
              {LEVEL_LABELS[l]}
              {forms?.[l].hasUnpublishedChanges ? <span className="ml-1.5 size-1.5 rounded-full bg-warning" aria-label="unpublished changes" /> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <SectionCard
        title={`${LEVEL_LABELS[level]} report form`}
        description={form.version ? `Published version ${form.version}${form.publishedAt ? ` · ${formatDateTime(form.publishedAt)}` : ""}` : "Not published yet"}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <div className="space-y-1.5">
            <Label htmlFor="form-title">Title</Label>
            <Input id="form-title" className="h-11" value={draft.title} maxLength={200} onChange={(e) => update({ title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="form-deadline">Deadline day</Label>
            <Input
              id="form-deadline" type="number" min={1} max={28} className="h-11" aria-describedby="form-deadline-hint"
              value={draft.deadlineDay}
              onChange={(e) => update({ deadlineDay: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })}
            />
            <p id="form-deadline-hint" className="text-xs text-muted-foreground">Admins can edit until this day of the next month (1–28).</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Questions"
        description="Number questions with Add up are totalled across areas, districts and the state."
        action={
          <div className="flex items-center gap-2">
            <Label htmlFor="preview-toggle" className="flex items-center gap-1.5 text-sm"><Eye className="size-4" />Preview</Label>
            <Switch id="preview-toggle" checked={preview} onCheckedChange={setPreview} />
          </div>
        }
      >
        {preview ? (
          draft.fields.length ? <ReportFormView fields={draft.fields} answers={previewAnswers} onChange={setPreviewAnswers} /> : (
            <EmptyState title="Nothing to preview" description="Add a question first." />
          )
        ) : (
          <div className="space-y-2">
            {draft.fields.length === 0 ? <EmptyState title="No questions yet" description="Add the first question below." /> : null}
            {draft.fields.map((f, i) => (
              <div key={f.id} className={`flex items-start gap-2 rounded-lg border p-2.5 ${f.type === "heading" ? "bg-muted/50" : ""}`}>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={`text-sm ${f.type === "heading" ? "font-semibold" : "font-medium"}`}>{f.label || <span className="text-muted-foreground">Untitled</span>}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[11px]">{FIELD_TYPE_LABELS[f.type]}</Badge>
                    {f.required ? <Badge variant="outline" className="text-[11px]">Required</Badge> : null}
                    {f.type === "number" && f.sum ? <Badge variant="outline" className="border-primary/40 text-[11px] text-primary">Add up</Badge> : null}
                    {f.condition ? (
                      <Badge variant="outline" className="max-w-full truncate text-[11px]">
                        Shown when “{labelOf(f.condition.fieldId)}” {OPERATOR_LABELS[f.condition.operator]}
                        {VALUELESS_OPERATORS.includes(f.condition.operator) ? "" : ` ${f.condition.value}`}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button variant="ghost" size="icon" aria-label={`Move ${f.label} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Move ${f.label} down`} disabled={i === draft.fields.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Edit ${f.label}`} onClick={() => setEditing(f)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${f.label}`} onClick={() => removeField(f)}><Trash2 className="size-4 text-destructive" /></Button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Select value={addType} onValueChange={(v) => setAddType(v as FieldType)}>
                <SelectTrigger aria-label="New question type" className="h-11 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{ADDABLE.map(t => <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" onClick={addField} className="min-h-11 gap-2"><Plus className="size-4" />Add question</Button>
            </div>
          </div>
        )}
      </SectionCard>

      <div className="sticky bottom-28 z-10 flex items-center justify-end gap-2 rounded-xl border bg-background/95 p-2 shadow-lg backdrop-blur lg:bottom-4">
        <p className="mr-auto hidden px-2 text-sm text-muted-foreground sm:block" aria-live="polite">
          {unsaved ? "Unsaved edits" : form.hasUnpublishedChanges ? "Draft saved, not published" : "All changes published"}
        </p>
        <Button variant="outline" onClick={saveDraft} disabled={!unsaved || busy !== null} className="min-h-11 gap-2">
          {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save draft
        </Button>
        <Button onClick={() => setConfirmPublish(true)} disabled={busy !== null || (!unsaved && !form.hasUnpublishedChanges)} className="min-h-11 gap-2">
          <Rocket className="size-4" />
          Publish
        </Button>
      </div>

      <FieldEditorDialog field={editing} earlierFields={earlierFields} onSave={saveField} onClose={() => setEditing(null)} />

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        busy={busy !== null}
        tone="primary"
        icon={Rocket}
        title={`Publish the ${LEVEL_LABELS[level].toLowerCase()} form?`}
        description="New reports use this version from now on. Reports already submitted keep the questions they were filled with."
        confirmLabel={`Publish version ${form.version + 1}`}
        onConfirm={publish}
      />
    </div>
  );
}
