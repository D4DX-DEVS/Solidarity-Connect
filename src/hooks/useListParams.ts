import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

export const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const toPositiveInt = (raw: string | null, fallback: number): number => {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
};

export interface ListParams {
  page: number;
  pageSize: number;
  getParam: (name: string) => string;
  setPage: (page: number) => void;
  /** Changes rows per page and returns to page 1. */
  setPageSize: (size: number) => void;
  /** Sets a filter and returns to page 1. An empty string removes it. */
  setParam: (name: string, value: string) => void;
  /** Sets several filters in one URL update and returns to page 1. */
  setParams: (changes: Record<string, string>) => void;
}

/**
 * URL-backed list state (page, page size, filters) so refresh, back/forward and
 * shared links reproduce the same view. `prefix` namespaces the keys when one
 * page hosts several lists, e.g. `areas_page=2`.
 */
export function useListParams(prefix = "", defaultPageSize = DEFAULT_PAGE_SIZE): ListParams {
  const [searchParams, setSearchParams] = useSearchParams();
  const key = useCallback((name: string) => (prefix ? `${prefix}_${name}` : name), [prefix]);

  const page = toPositiveInt(searchParams.get(key("page")), 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, toPositiveInt(searchParams.get(key("pageSize")), defaultPageSize));

  const update = useCallback(
    (changes: Record<string, string | number | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(changes).forEach(([name, value]) => {
            if (value === null || value === "") next.delete(key(name));
            else next.set(key(name), String(value));
          });
          return next;
        },
        { replace: true },
      );
    },
    [key, setSearchParams],
  );

  const getParam = useCallback((name: string) => searchParams.get(key(name)) ?? "", [key, searchParams]);
  const setPage = useCallback((p: number) => update({ page: p > 1 ? p : null }), [update]);
  const setPageSize = useCallback(
    (size: number) => update({ pageSize: size === defaultPageSize ? null : size, page: null }),
    [update, defaultPageSize],
  );
  const setParam = useCallback((name: string, value: string) => update({ [name]: value, page: null }), [update]);
  const setParams = useCallback((changes: Record<string, string>) => update({ ...changes, page: null }), [update]);

  return { page, pageSize, getParam, setPage, setPageSize, setParam, setParams };
}

/**
 * Text input bound to a URL param of `list`, committed after `delay` ms without
 * typing. Returns the live draft for the input's value/onChange.
 */
export function useDebouncedParam(list: ListParams, name: string, delay = 300) {
  const committed = list.getParam(name);
  const { setParam } = list;
  const [draft, setDraft] = useState(committed);
  const pushed = useRef(committed);

  // Follow URL changes made elsewhere (back/forward, "Clear search"). Skip the
  // echo of our own commit — it can land after newer keystrokes and erase them.
  useEffect(() => {
    if (committed === pushed.current) return;
    pushed.current = committed;
    setDraft(committed);
  }, [committed]);

  useEffect(() => {
    if (draft === committed) return;
    const timer = setTimeout(() => {
      pushed.current = draft;
      setParam(name, draft);
    }, delay);
    return () => clearTimeout(timer);
  }, [draft, committed, delay, name, setParam]);

  return [draft, setDraft] as const;
}
