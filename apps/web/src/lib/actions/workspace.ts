"use server";

import {
  CLIENT_WORKSPACE_COOKIE,
  parseClientWorkspaceMode,
} from "@/lib/workspace/client-workspace-mode";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function setClientWorkspaceModeAction(
  mode: string,
  redirectTo?: string,
): Promise<void> {
  const next = parseClientWorkspaceMode(mode);
  const jar = await cookies();
  jar.set(CLIENT_WORKSPACE_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  if (redirectTo?.startsWith("/")) {
    redirect(redirectTo);
  }
}
