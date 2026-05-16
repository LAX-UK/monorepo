"use server";

import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { allMarketingViewCookieNames } from "@/lib/preferences/list-views";
import { THEME_COOKIE_MAX_AGE_SEC, THEME_COOKIE_NAME } from "@/lib/preferences/theme-cookie";
import { uiPreferencePatchSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

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
  if (parsed.data.theme !== undefined) {
    jar.set(THEME_COOKIE_NAME, parsed.data.theme, {
      path: "/",
      maxAge: THEME_COOKIE_MAX_AGE_SEC,
      sameSite: "lax",
    });
  }
  revalidatePath("/dashboard/settings/appearance");
  return actionSuccess();
}

/** Header toggle: persist DB + cookie when signed in; no-op when anonymous. */
export async function syncUiThemeFromClientAction(input: unknown): Promise<void> {
  const user = await getServerSessionUser();
  if (!user) return;
  const parsed = uiPreferencePatchSchema.safeParse(input);
  if (!parsed.success || parsed.data.theme === undefined) return;
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

/** Reset catalogue layout defaults server-side and clear per-route view cookies. */
export async function resetLayoutPreferencesAction(): Promise<ActionResult<void>> {
  const user = await getServerSessionUser();
  if (!user) {
    return actionFailure("Sign in required", undefined, 401);
  }
  const { uiPrefs } = getWriteContainer();
  const r = await uiPrefs.postResetLayout();
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  const jar = await cookies();
  for (const name of allMarketingViewCookieNames()) {
    jar.delete(name);
  }
  revalidatePath("/dashboard/settings/appearance");
  revalidatePath("/search");
  revalidatePath("/archive");
  revalidatePath("/sales");
  revalidatePath("/artists");
  return actionSuccess();
}
