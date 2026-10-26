import { type ZodErrorMap, ZodIssueCode } from "zod";

/**
 * Plain-language wording for the validation messages a schema gives no message of its own, so a
 * staff form says how to fix a field ("Enter a full web address…") rather than "Invalid url".
 * Pass it to the resolver: `zodResolver(schema, { errorMap: staffErrorMap })`. Messages a schema
 * sets itself still win.
 */
export const staffErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") {
        return { message: "Enter a value" };
      }
      if (issue.expected === "integer") return { message: "Enter a whole number" };
      if (issue.received === "nan" || issue.expected === "number") {
        return { message: "Enter a number" };
      }
      break;
    case ZodIssueCode.invalid_string:
      if (issue.validation === "url") {
        return { message: "Enter a full web address, starting with https://" };
      }
      if (issue.validation === "email") {
        return { message: "Enter an email address, like name@example.com" };
      }
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "string") {
        return { message: `Use ${issue.maximum} characters or fewer` };
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "string") {
        return {
          message:
            issue.minimum === 1 ? "Enter a value" : `Use at least ${issue.minimum} characters`,
        };
      }
      break;
    default:
      break;
  }
  return { message: ctx.defaultError };
};

/** The resolver's parse options carrying `staffErrorMap`: `zodResolver(schema, STAFF_PARSE_PARAMS)`. */
export const STAFF_PARSE_PARAMS = {
  errorMap: staffErrorMap,
  path: [] as (string | number)[],
  async: false,
};
