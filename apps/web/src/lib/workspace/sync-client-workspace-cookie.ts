import {
  CLIENT_WORKSPACE_COOKIE,
  CLIENT_WORKSPACE_COOKIE_OPTIONS,
  parseClientWorkspaceMode,
  resolveClientWorkspaceMode,
} from "@/lib/workspace/client-workspace-mode";
import type { NextRequest, NextResponse } from "next/server";

/** Keep workspace cookie aligned with mode-specific dashboard routes (SSR + nav). */
export function syncClientWorkspaceCookie(request: NextRequest, response: NextResponse): void {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/dashboard")) return;

  const cookieMode = parseClientWorkspaceMode(request.cookies.get(CLIENT_WORKSPACE_COOKIE)?.value);
  const resolved = resolveClientWorkspaceMode(pathname, cookieMode);
  if (resolved === cookieMode) return;

  response.cookies.set(CLIENT_WORKSPACE_COOKIE, resolved, CLIENT_WORKSPACE_COOKIE_OPTIONS);
}
