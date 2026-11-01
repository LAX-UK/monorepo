import { publicFormErrorMap } from "@/lib/forms/error-copy";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { ZodErrorMap, ZodType } from "zod";

/**
 * A react-hook-form resolver for a Zod schema whose messages are the public copy: a message the
 * schema states itself wins, and everything else is phrased by `publicFormErrorMap`.
 */
export function publicFormResolver<TFieldValues extends FieldValues>(
  schema: ZodType<TFieldValues>,
  errorMap: ZodErrorMap = publicFormErrorMap,
): Resolver<TFieldValues> {
  // @hookform/resolvers v5 expects Zod 4 `$ZodType`; the schemas here are Zod 3.
  return zodResolver(schema as never, { errorMap } as never) as Resolver<TFieldValues>;
}
