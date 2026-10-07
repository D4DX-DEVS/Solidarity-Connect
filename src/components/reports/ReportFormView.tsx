import { FileText } from "lucide-react";
import { ReportFieldInput } from "./ReportFieldInput";
import {
  answerKey, formatAnswer, isEmptyAnswer, visibleFields,
  type AnswerValue, type Answers, type FileAnswer, type ReportField,
} from "@/lib/reportForm";

interface ReportFormViewProps {
  fields: ReportField[];
  answers: Answers;
  /** Omit for a read-only view of the answers. */
  onChange?: (answers: Answers) => void;
  errors?: Record<number, string>;
  disabled?: boolean;
}

interface Section {
  heading: ReportField | null;
  fields: ReportField[];
}

/** Questions grouped under the heading that precedes them. */
function toSections(fields: ReportField[]): Section[] {
  const sections: Section[] = [];
  for (const field of fields) {
    if (field.type === "heading") sections.push({ heading: field, fields: [] });
    else if (sections.length) sections[sections.length - 1].fields.push(field);
    else sections.push({ heading: null, fields: [field] });
  }
  return sections;
}

// How many grid columns a question takes: counts sit side by side, choice lists and long text take the full row.
const FULL_ROW: ReadonlySet<ReportField["type"]> = new Set(["textarea", "radio", "checkbox"]);
const NARROW: ReadonlySet<ReportField["type"]> = new Set(["number", "time"]);

function cellSpan(type: ReportField["type"]): string {
  if (FULL_ROW.has(type)) return "col-span-full";
  if (NARROW.has(type)) return "";
  return "col-span-2 sm:col-span-1";
}

/** A report form: editable when `onChange` is given, otherwise the answers as text. */
export function ReportFormView({ fields, answers, onChange, errors = {}, disabled }: ReportFormViewProps) {
  const sections = toSections(visibleFields(fields, answers));
  const readOnly = !onChange;

  return (
    <div className="space-y-6">
      {sections.map((section, i) => (
        <section key={section.heading?.id ?? `top-${i}`} className="space-y-4">
          {section.heading ? (
            <div className="border-b pb-1.5">
              <h3 className="text-base font-semibold">{section.heading.label}</h3>
              {section.heading.helpText ? <p className="text-xs text-muted-foreground">{section.heading.helpText}</p> : null}
            </div>
          ) : null}
          {readOnly ? (
            <div className="space-y-5">
              {section.fields.map(field => <AnswerRow key={field.id} field={field} value={answers[answerKey(field.id)]} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
              {section.fields.map(field => (
                <ReportFieldInput
                  key={field.id}
                  field={field}
                  value={answers[answerKey(field.id)]}
                  error={errors[field.id]}
                  disabled={disabled}
                  onChange={(next) => onChange({ ...answers, [answerKey(field.id)]: next })}
                  // Label, control and error rows line up with the other questions in the same row.
                  className={`row-span-3 grid-rows-subgrid ${cellSpan(field.type)}`}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function AnswerRow({ field, value }: { field: ReportField; value: AnswerValue }) {
  const file = field.type === "file" && value && typeof value === "object" && !Array.isArray(value) ? (value as FileAnswer) : null;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-sm text-muted-foreground">{field.label}</span>
      {file ? (
        <a href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <FileText className="size-4" />
          {file.name || "View file"}
        </a>
      ) : (
        <span className={`text-sm font-semibold sm:text-right ${field.type === "number" ? "tabular-nums" : ""} ${isEmptyAnswer(value) ? "text-muted-foreground" : ""}`}>
          {formatAnswer(field, value)}
        </span>
      )}
    </div>
  );
}
