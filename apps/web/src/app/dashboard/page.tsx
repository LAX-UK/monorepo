import {
  CLIENT_WORKSPACE_COOKIE,
  clientWorkspaceHomePath,
  parseClientWorkspaceMode,
} from "@/lib/workspace/client-workspace-mode";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * There is no client dashboard: `/dashboard` only keeps old links and post-sign-in
 * destinations working by sending people to their workspace's first page. The query string
 * is kept because callers attach toast and analytics parameters to it.
 */
export default async function DashboardIndexPage({ searchParams }: PageProps) {
  const jar = await cookies();
  const mode = parseClientWorkspaceMode(jar.get(CLIENT_WORKSPACE_COOKIE)?.value);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, entry);
    }
  }
  const qs = query.toString();
  redirect(`${clientWorkspaceHomePath(mode)}${qs ? `?${qs}` : ""}`);
}
