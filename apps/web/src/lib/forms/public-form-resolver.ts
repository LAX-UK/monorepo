import { publicFormErrorMap } from "@/lib/forms/error-copy";
import { zodFormResolver } from "@/lib/forms/zod-form-resolver";
import type { FieldValues, Resolver } from "react-hook-form";
import type { ZodErrorMap, ZodType } from "zod";

/**
 * `zodFormResolver` with the public copy: a message the schema states itself wins, and everything
 * else is phrased by `publicFormErrorMap`.
 */
export function publicFormResolver<TFieldValues extends FieldValues>(
  schema: ZodType<TFieldValues>,
  errorMap: ZodErrorMap = publicFormErrorMap,
): Resolver<TFieldValues> {
  return zodFormResolver(schema, errorMap);
}
