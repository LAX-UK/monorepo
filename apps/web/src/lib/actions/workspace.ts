"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import {
  CLIENT_WORKSPACE_COOKIE,
  CLIENT_WORKSPACE_COOKIE_OPTIONS,
  parseClientWorkspaceMode,
} from "@/lib/workspace/client-workspace-mode";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function setClientWorkspaceModeAction(
  mode: string,
  redirectTo?: string,
): Promise<void> {
  return instrumentServerAction("setClientWorkspaceModeAction", async () => {
    const next = parseClientWorkspaceMode(mode);
    const jar = await cookies();
    jar.set(CLIENT_WORKSPACE_COOKIE, next, CLIENT_WORKSPACE_COOKIE_OPTIONS);
    if (redirectTo?.startsWith("/")) {
      redirect(redirectTo);
    }
  });
}
