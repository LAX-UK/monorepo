"use server";

import {
  type MergeBasketOnSignInResult,
  mergeBasketOnSignIn,
} from "@/lib/merge-basket-on-sign-in.server";

export async function mergeBasketAfterSignIn(): Promise<MergeBasketOnSignInResult> {
  return mergeBasketOnSignIn();
}
