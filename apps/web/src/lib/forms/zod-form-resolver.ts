import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { ZodErrorMap, ZodType } from "zod";

/** A react-hook-form resolver for a Zod schema, with optional wording for unphrased checks. */
export function zodFormResolver<TFieldValues extends FieldValues>(
  schema: ZodType<TFieldValues>,
  errorMap?: ZodErrorMap,
): Resolver<TFieldValues> {
  // @hookform/resolvers v5 expects Zod 4 `$ZodType`; we use Zod 3 schemas at call sites.
  return zodResolver(schema as never, errorMap ? ({ errorMap } as never) : undefined);
}
