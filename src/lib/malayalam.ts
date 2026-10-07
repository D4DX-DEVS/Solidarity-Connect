import type { ReactNode } from "react";

const MALAYALAM = /[ഀ-ൿ]/;

/**
 * `lang="ml"` for text containing Malayalam, so it renders in Noto Sans Malayalam
 * (the `[lang="ml"]` rule in index.css) and screen readers read it as Malayalam.
 */
export function langOf(text: ReactNode): "ml" | undefined {
  return typeof text === "string" && MALAYALAM.test(text) ? "ml" : undefined;
}
