import { type SubjectExportFileRef, subjectExportFileRefSchema } from "@auction/identity-contracts";

/**
 * Replaces every file reference found anywhere inside a record, in document order. A reference is
 * recognised by its full shape (link, name, type, size and expiry), so ordinary fields are left
 * alone. The record is not changed; a copy is returned.
 */
export async function mapFileRefs(
  value: unknown,
  replace: (ref: SubjectExportFileRef) => Promise<unknown>,
): Promise<unknown> {
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) out.push(await mapFileRefs(item, replace));
    return out;
  }
  if (value === null || typeof value !== "object") return value;
  const ref = subjectExportFileRefSchema.safeParse(value);
  if (ref.success) return replace(ref.data);
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) out[key] = await mapFileRefs(child, replace);
  return out;
}
