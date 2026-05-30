import { applyZodErrorsToForm } from "@/lib/admin/zod-form-errors";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type { ZodIssue } from "zod";

type PathMapper = (path: (string | number)[]) => string;

/** Apply a single Zod issue path/message pair. */
export function applyCatalogZodIssueToForm<T extends FieldValues>(
  form: UseFormReturn<T>,
  path: (string | number)[],
  message: string,
  mapPath?: PathMapper,
): void {
  const resolved = mapPath ? mapPath(path) : path.map(String).join(".");
  applyZodErrorsToForm(form, resolved, message);
}

/** Apply Zod issues to a catalog wizard/form using a shared path mapper. */
export function applyCatalogZodIssuesToForm<T extends FieldValues>(
  form: UseFormReturn<T>,
  issues: ZodIssue[],
  mapPath: PathMapper = (path) => path.map(String).join("."),
): void {
  for (const issue of issues) {
    if (!issue.path.length) continue;
    applyCatalogZodIssueToForm(form, [...issue.path], issue.message, mapPath);
  }
}
