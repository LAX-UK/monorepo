"use server";

import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";

type InstrumentServerActionOptions = {
  formData?: FormData;
  recordResponse?: boolean;
};

/** Wrap Server Actions with Sentry performance and error instrumentation. */
export async function instrumentServerAction<T>(
  name: string,
  fn: () => Promise<T>,
  options?: InstrumentServerActionOptions,
): Promise<T> {
  return Sentry.withServerActionInstrumentation(
    name,
    {
      headers: await headers(),
      recordResponse: options?.recordResponse ?? true,
      ...(options?.formData ? { formData: options.formData } : {}),
    },
    fn,
  );
}
