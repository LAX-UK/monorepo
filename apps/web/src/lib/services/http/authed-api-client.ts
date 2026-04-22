import "server-only";

import { readApiError } from "@/lib/actions/_utils";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ServiceResult, bodyToServiceFailure, serviceSuccess } from "./service-result";

/**
 * Low-level API client (DIP). Server-only: uses session cookies via `authedServerFetch`.
 */
export interface IAuthedApiClient {
  json<T>(path: string, init?: RequestInit): Promise<ServiceResult<T>>;
  request(path: string, init?: RequestInit): Promise<Response>;
}

export class AuthedApiClient implements IAuthedApiClient {
  async request(path: string, init?: RequestInit): Promise<Response> {
    return authedServerFetch(path, init);
  }

  async json<T>(path: string, init?: RequestInit): Promise<ServiceResult<T>> {
    const res = await this.request(path, init);
    const text = await res.text();
    const body: unknown = text
      ? (() => {
          try {
            return JSON.parse(text) as unknown;
          } catch {
            return { raw: text } as unknown;
          }
        })()
      : {};
    if (!res.ok) {
      return bodyToServiceFailure(body, res.status, "Request failed");
    }
    return serviceSuccess(body as T, res.status);
  }
}

let singleton: AuthedApiClient | null = null;

export function getAuthedApiClient(): IAuthedApiClient {
  if (!singleton) singleton = new AuthedApiClient();
  return singleton;
}
