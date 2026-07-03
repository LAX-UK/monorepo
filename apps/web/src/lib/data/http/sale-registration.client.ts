import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";

export type SaleRegistrationInput = {
  buyerLegalEntityId: string;
  bidLimit?: number;
};

export type SaleRegistrationResult = { ok: true } | { ok: false; error: string; code?: string };

/** POST /sales/:saleId/register */
export async function registerForSale(
  saleId: string,
  input: SaleRegistrationInput,
): Promise<SaleRegistrationResult> {
  try {
    const res = await browserFetch(
      `${browserApiBase()}/sales/${encodeURIComponent(saleId)}/register`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (!res.ok) {
      return {
        ok: false,
        error: payload.error ?? "Could not submit registration",
        ...(payload.code ? { code: payload.code } : {}),
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not submit registration" };
  }
}
