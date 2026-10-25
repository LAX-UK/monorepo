"use server";

import { unsubscribeEditionAlerts } from "@/lib/shop-edition-alerts.server";
import { redirect } from "next/navigation";

/** The confirm button on the unsubscribe page. The token in the email is the only credential. */
export async function confirmEditionAlertUnsubscribe(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const result = await unsubscribeEditionAlerts(token);
  const params = new URLSearchParams({ token });
  params.set("result", result.status === "ok" ? "stopped" : result.status);
  redirect(`/alerts/stop?${params.toString()}`);
}
