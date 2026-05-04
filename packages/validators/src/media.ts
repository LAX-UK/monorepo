import { z } from "zod";

const storageKeyPattern = /^[a-zA-Z0-9][a-zA-Z0-9._~!$&'()*+,;=:@/-]*$/;

export const mediaReferenceSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine((value) => {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return z.string().url().safeParse(value).success;
    }
    return !value.includes("..") && storageKeyPattern.test(value);
  }, "Must be a valid URL or storage key");
