import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";

function adminHeaders(baseUrl: string, cookieHeader: string, csrfToken: string) {
  return {
    cookie: cookieHeader,
    origin: baseUrl,
    "x-csrf-token": csrfToken,
    "content-type": "application/json",
    "idempotency-key": randomUUID(),
  };
}

export function createAdminApiClient(request: APIRequestContext, baseUrl: string) {
  const root = baseUrl.replace(/\/+$/, "");
  return {
    getSession(cookieHeader: string) {
      return request.get(`${root}/api/admin/session`, {
        headers: { cookie: cookieHeader },
      });
    },
    post(path: string, cookieHeader: string, csrfToken: string, body: unknown) {
      return request.post(`${root}/api/admin/${path.replace(/^\//, "")}`, {
        headers: adminHeaders(root, cookieHeader, csrfToken),
        data: body,
      });
    },
    patch(path: string, cookieHeader: string, csrfToken: string, body: unknown) {
      return request.patch(`${root}/api/admin/${path.replace(/^\//, "")}`, {
        headers: adminHeaders(root, cookieHeader, csrfToken),
        data: body,
      });
    },
  };
}
