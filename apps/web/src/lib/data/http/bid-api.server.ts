import "server-only";

export function fetchBidApi(input: string | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init);
}
