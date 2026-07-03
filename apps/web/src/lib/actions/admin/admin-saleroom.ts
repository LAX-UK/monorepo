"use server";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
} from "@/lib/forms/form-result";
import { SALEROOM_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const saleroomSaleIdForm = z.object({
  saleId: z.string().uuid(),
});

const saleroomAdvanceForm = z.object({
  saleId: z.string().uuid(),
  lotId: z.string().uuid(),
});

const displayApproveForm = z.object({
  saleId: z.string().uuid(),
  userCode: z.string().trim().min(4).max(12),
});

const displayOverlayForm = z.object({
  saleId: z.string().uuid(),
  kind: z.enum(["fair_warning", "announcement"]),
  message: z.string().trim().max(500).optional(),
});

const displayRevokeForm = z.object({
  saleId: z.string().uuid(),
  pairingId: z.string().uuid(),
});

function saleroomActionError(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string" && error.length > 0) return error;
  }
  return fallback;
}

async function runSaleroomSaleMutation(
  saleId: string,
  mutate: (id: string) => Promise<{ ok: boolean; body?: unknown; status?: number }>,
  fallback: string,
): Promise<ActionResult<void>> {
  const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
  if (denied) return denied;

  const res = await mutate(saleId);
  if (!res.ok) {
    return actionFailure(saleroomActionError(res.body, fallback), undefined, res.status);
  }
  revalidatePath(`/admin/saleroom/${saleId}`);
  return actionSuccess();
}

export async function adminSaleroomGoLiveAction(input: unknown): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSaleroomGoLiveAction", async () => {
    const parsed = saleroomSaleIdForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    const { saleId } = parsed.data;
    return runSaleroomSaleMutation(
      saleId,
      (id) => getWriteContainer().adminSaleroom.goLive(id),
      "Go live failed",
    );
  });
}

export async function adminSaleroomPauseAction(input: unknown): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSaleroomPauseAction", async () => {
    const parsed = saleroomSaleIdForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    const { saleId } = parsed.data;
    return runSaleroomSaleMutation(
      saleId,
      (id) => getWriteContainer().adminSaleroom.pause(id),
      "Pause failed",
    );
  });
}

export async function adminSaleroomResumeAction(input: unknown): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSaleroomResumeAction", async () => {
    const parsed = saleroomSaleIdForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    const { saleId } = parsed.data;
    return runSaleroomSaleMutation(
      saleId,
      (id) => getWriteContainer().adminSaleroom.resume(id),
      "Resume failed",
    );
  });
}

export async function adminSaleroomAdvanceAction(input: unknown): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSaleroomAdvanceAction", async () => {
    const parsed = saleroomAdvanceForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    const { saleId, lotId } = parsed.data;
    const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
    if (denied) return denied;

    const res = await getWriteContainer().adminSaleroom.advance(saleId, lotId);
    if (!res.ok) {
      return actionFailure(saleroomActionError(res.body, "Advance failed"), undefined, res.status);
    }
    revalidatePath(`/admin/saleroom/${saleId}`);
    return actionSuccess();
  });
}

export async function adminSaleroomHammerAction(input: unknown): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSaleroomHammerAction", async () => {
    const parsed = saleroomSaleIdForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    const { saleId } = parsed.data;
    return runSaleroomSaleMutation(
      saleId,
      (id) => getWriteContainer().adminSaleroom.hammer(id),
      "Hammer failed",
    );
  });
}

export async function adminSaleroomNoSaleAction(input: unknown): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSaleroomNoSaleAction", async () => {
    const parsed = saleroomSaleIdForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    const { saleId } = parsed.data;
    return runSaleroomSaleMutation(
      saleId,
      (id) => getWriteContainer().adminSaleroom.noSale(id),
      "No sale failed",
    );
  });
}

export async function adminSaleroomCloseAction(input: unknown): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSaleroomCloseAction", async () => {
    const parsed = saleroomSaleIdForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    const { saleId } = parsed.data;
    return runSaleroomSaleMutation(
      saleId,
      (id) => getWriteContainer().adminSaleroom.close(id),
      "Close failed",
    );
  });
}

export async function adminSaleroomDisplayApproveAction(
  input: unknown,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSaleroomDisplayApproveAction", async () => {
    const parsed = displayApproveForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    const { saleId, userCode } = parsed.data;
    const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
    if (denied) return denied;

    const res = await getWriteContainer().adminSaleroom.displayApprove(saleId, userCode);
    if (!res.ok) {
      return actionFailure(
        saleroomActionError(res.body, "Display approve failed"),
        undefined,
        res.status,
      );
    }
    revalidatePath(`/admin/saleroom/${saleId}`);
    return actionSuccess();
  });
}

export async function adminSaleroomDisplayOverlayAction(
  input: unknown,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSaleroomDisplayOverlayAction", async () => {
    const parsed = displayOverlayForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    const { saleId, kind, message } = parsed.data;
    const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
    if (denied) return denied;

    const res = await getWriteContainer().adminSaleroom.displayOverlay(saleId, kind, message);
    if (!res.ok) {
      return actionFailure(saleroomActionError(res.body, "Overlay failed"), undefined, res.status);
    }
    revalidatePath(`/admin/saleroom/${saleId}`);
    return actionSuccess();
  });
}

export async function adminSaleroomDisplayClearOverlayAction(
  input: unknown,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSaleroomDisplayClearOverlayAction", async () => {
    const parsed = saleroomSaleIdForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    const { saleId } = parsed.data;
    return runSaleroomSaleMutation(
      saleId,
      (id) => getWriteContainer().adminSaleroom.displayClearOverlay(id),
      "Clear overlay failed",
    );
  });
}

export async function adminSaleroomDisplayRevokeAction(
  input: unknown,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSaleroomDisplayRevokeAction", async () => {
    const parsed = displayRevokeForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }
    const { saleId, pairingId } = parsed.data;
    const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
    if (denied) return denied;

    const res = await getWriteContainer().adminSaleroom.displayRevoke(saleId, pairingId);
    if (!res.ok) {
      return actionFailure(saleroomActionError(res.body, "Revoke failed"), undefined, res.status);
    }
    revalidatePath(`/admin/saleroom/${saleId}`);
    return actionSuccess();
  });
}
