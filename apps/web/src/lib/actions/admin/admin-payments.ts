"use server";

import {
  assertAdminCapabilityForRedirect,
  denyUnlessAdminCapability,
} from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { FINANCE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function adminRefundPaymentAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminRefundPaymentAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(FINANCE_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/payments?error=${encodeURIComponent(denied.message)}`);
      }
      const id = String(formData.get("paymentId") ?? "").trim();
      if (!id) redirect(`/admin/payments?error=${encodeURIComponent("Missing payment")}`);
      const { adminPayments } = getWriteContainer();
      const r = await adminPayments.refund(id);
      if (!r.ok) {
        redirect(`/admin/payments?error=${encodeURIComponent(r.message)}`);
      }
      revalidatePath("/admin/payments");
      redirect("/admin/payments");
    },
    { formData },
  );
}

export async function adminCapturePaymentAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminCapturePaymentAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(FINANCE_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/payments?error=${encodeURIComponent(denied.message)}`);
      }
      const id = String(formData.get("paymentId") ?? "").trim();
      if (!id) redirect(`/admin/payments?error=${encodeURIComponent("Missing payment")}`);
      const { adminPayments } = getWriteContainer();
      const r = await adminPayments.capture(id);
      if (!r.ok) {
        redirect(`/admin/payments?error=${encodeURIComponent(r.message)}`);
      }
      revalidatePath("/admin/payments");
      redirect("/admin/payments");
    },
    { formData },
  );
}

export async function adminCapturePaymentResultAction(
  paymentId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminCapturePaymentResultAction", async () => {
    const denied = await denyUnlessAdminCapability(FINANCE_ACCESS);
    if (denied) return denied;
    const id = paymentId.trim();
    if (!id) {
      return actionFailure("Missing payment");
    }
    const { adminPayments } = getWriteContainer();
    const r = await adminPayments.capture(id);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/payments");
    return actionSuccess();
  });
}

export async function adminRefundPaymentResultAction(
  paymentId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminRefundPaymentResultAction", async () => {
    const denied = await denyUnlessAdminCapability(FINANCE_ACCESS);
    if (denied) return denied;
    const id = paymentId.trim();
    if (!id) {
      return actionFailure("Missing payment");
    }
    const { adminPayments } = getWriteContainer();
    const r = await adminPayments.refund(id);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/payments");
    return actionSuccess();
  });
}

export async function adminPaymentXeroSyncResultAction(
  paymentId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminPaymentXeroSyncResultAction", async () => {
    const denied = await denyUnlessAdminCapability(FINANCE_ACCESS);
    if (denied) return denied;
    const id = paymentId.trim();
    if (!id) {
      return actionFailure("Missing payment");
    }
    const { adminPayments } = getWriteContainer();
    const r = await adminPayments.xeroSync(id);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    if (!r.data.ok) {
      return actionFailure(r.data.error ?? "Xero sync failed");
    }
    revalidatePath("/admin/payments");
    return actionSuccess();
  });
}

export async function adminXeroOAuthStartAction(): Promise<void> {
  return instrumentServerAction("adminXeroOAuthStartAction", async () => {
    const denied = await assertAdminCapabilityForRedirect(FINANCE_ACCESS);
    if (!denied.ok) {
      redirect(`/admin/integrations/xero?error=${encodeURIComponent(denied.message)}`);
    }
    const res = await authedServerFetch("/admin/integrations/xero/oauth/consent-url");
    if (!res.ok) {
      redirect(
        `/admin/integrations/xero?error=${encodeURIComponent("Could not start Xero OAuth")}`,
      );
    }
    const body = (await res.json()) as { data: { url: string } };
    redirect(body.data.url);
  });
}

export async function adminXeroDisconnectAction(): Promise<void> {
  return instrumentServerAction("adminXeroDisconnectAction", async () => {
    const denied = await assertAdminCapabilityForRedirect(FINANCE_ACCESS);
    if (!denied.ok) {
      redirect(`/admin/integrations/xero?error=${encodeURIComponent(denied.message)}`);
    }
    const res = await authedServerFetch("/admin/integrations/xero/disconnect", { method: "POST" });
    if (!res.ok) {
      redirect(`/admin/integrations/xero?error=${encodeURIComponent("Disconnect failed")}`);
    }
    revalidatePath("/admin/integrations/xero");
    redirect("/admin/integrations/xero");
  });
}
