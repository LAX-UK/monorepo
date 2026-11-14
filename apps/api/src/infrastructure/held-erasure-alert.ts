import { captureBackgroundError } from "@auction/observability";

/**
 * Tells the background-alert channel that a request's held erasure needs a person. It carries the
 * request reference and the reason, nothing about the person.
 */
export function reportHeldErasureNeedsStaff(reference: string, reason: string): void {
  captureBackgroundError("held-erasure", new Error(`A held erasure needs staff: ${reason}`), {
    extra: { reference, reason },
  });
}
