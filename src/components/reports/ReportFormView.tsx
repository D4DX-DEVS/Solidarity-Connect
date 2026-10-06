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

/** A report form: editable when `onChange` is given, otherwise the answers as text. */
export function ReportFormView({ fields, answers, onChange, errors = {}, disabled }: ReportFormViewProps) {
  const shown = visibleFields(fields, answers);
  const readOnly = !onChange;

  return (
    <div className="space-y-5">
      {shown.map((field) => {
        if (field.type === "heading") {
          return (
            <div key={field.id} className="border-b pb-1.5 pt-2 first:pt-0">
              <h3 className="text-base font-semibold">{field.label}</h3>
              {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
            </div>
          );
        }
        const value = answers[answerKey(field.id)];
        if (readOnly) return <AnswerRow key={field.id} field={field} value={value} />;
        return (
          <ReportFieldInput
            key={field.id}
            field={field}
            value={value}
            error={errors[field.id]}
            disabled={disabled}
            onChange={(next) => onChange({ ...answers, [answerKey(field.id)]: next })}
          />
        );
      })}
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
