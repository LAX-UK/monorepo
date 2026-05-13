"use server";

import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { THEME_COOKIE_MAX_AGE_SEC, THEME_COOKIE_NAME } from "@/lib/preferences/theme-cookie";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { uiPreferencePatchSchema } from "@auction/validators";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function updateUiPreferencesAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = uiPreferencePatchSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const { uiPrefs } = getWriteContainer();
  const r = await uiPrefs.patch(parsed.data);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  const jar = await cookies();
  jar.set(THEME_COOKIE_NAME, parsed.data.theme, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE_SEC,
    sameSite: "lax",
  });
  revalidatePath("/dashboard/settings/appearance");
  return actionSuccess();
}

/** Header toggle: persist DB + cookie when signed in; no-op when anonymous. */
export async function syncUiThemeFromClientAction(input: unknown): Promise<void> {
  const user = await getServerSessionUser();
  if (!user) return;
  const parsed = uiPreferencePatchSchema.safeParse(input);
  if (!parsed.success) return;
  const { uiPrefs } = getWriteContainer();
  const r = await uiPrefs.patch(parsed.data);
  if (!r.ok) return;
  const jar = await cookies();
  jar.set(THEME_COOKIE_NAME, parsed.data.theme, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE_SEC,
    sameSite: "lax",
  });
}
