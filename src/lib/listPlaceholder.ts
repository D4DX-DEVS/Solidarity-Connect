import { keepPreviousData, type Query } from "@tanstack/react-query";

/**
 * "page": hold the current rows on screen only while flipping pages; a filter,
 * search or page-size change shows the skeleton instead of stale rows.
 * "always": hold them for any param change (keeps inputs mounted on pages that
 * swap the whole view while loading).
 */
export type KeepPrevious = "page" | "always";

const withoutPage = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "page"));
};

const differsOnlyByPage = (a: unknown, b: unknown): boolean => {
  const x = withoutPage(a);
  const y = withoutPage(b);
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
  return [...keys].every((key) => x[key] === y[key]);
};

/** `placeholderData` for list queries whose key ends with the params object. */
export function listPlaceholder<T>(mode: KeepPrevious | undefined, params: unknown) {
  if (mode === "always") return keepPreviousData;
  if (mode !== "page") return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Query generics vary per hook
  return (previous: T | undefined, previousQuery: Query<any, any, any, any> | undefined) =>
    differsOnlyByPage(previousQuery?.queryKey[previousQuery.queryKey.length - 1], params ?? {}) ? previous : undefined;
}
