import type { SsfHttpDispatcher } from "../services/ssf.ports.js";

export class HttpSsfDispatcher implements SsfHttpDispatcher {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async dispatch(endpoint: string, setToken: string, timeoutMs: number) {
    const response = await this.fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/secevent+jwt" },
      body: setToken,
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: response.status };
  }
}
