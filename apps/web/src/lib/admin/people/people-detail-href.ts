import { ADMIN_LIST_RETURN_TO_PARAM } from "@/lib/admin/admin-list-return-context";

export function buildPeopleDetailHref(path: string, listReturnTarget?: string): string {
  if (!listReturnTarget?.trim()) return path;
  const url = new URL(path, "http://local");
  url.searchParams.set(ADMIN_LIST_RETURN_TO_PARAM, listReturnTarget.trim());
  return `${url.pathname}${url.search}`;
}
