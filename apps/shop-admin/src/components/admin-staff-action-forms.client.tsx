"use client";

import {
  AdminMutationFeedback,
  adminFormFieldClass,
  adminFormLabelClass,
  adminFormSectionClass,
} from "@/components/admin-mutation-feedback";
import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  adjustMerchandiseStock,
  importArtwork,
} from "@/server/application/admin-catalogue-actions.server";
import {
  cancelOrderAfterPossession,
  createProductionTask,
  markPayoutPaid,
  recordFulfilmentPossession,
  requestOrderRefund,
  updateFulfilment,
} from "@/server/application/admin-operations-actions.server";
import {
  grantArtworkSaleAuthority,
  grantStaffRole,
  linkArtistIdentity,
  revokeStaffRole,
  unlinkArtistIdentity,
} from "@/server/application/admin-people-actions.server";
import {
  approveSaleFee,
  createOriginalSale,
  createStockHold,
  recordThirdPartySale,
  releaseStockHold,
} from "@/server/application/admin-sales-actions.server";
import { type ReactNode, useState } from "react";

const STAFF_ROLES = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
] as const;

export function GrantStaffRoleForm() {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [identitySubjectId, setIdentitySubjectId] = useState("");
  const [role, setRole] = useState<(typeof STAFF_ROLES)[number]>("operations");

  return (
    <FormSection title="Grant staff role">
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">Identity subject ID</span>
        <input
          className={adminFormFieldClass}
          value={identitySubjectId}
          disabled={pending}
          onChange={(e) => setIdentitySubjectId(e.target.value)}
        />
      </label>
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">Role</span>
        <select
          className={adminFormFieldClass}
          value={role}
          disabled={pending}
          onChange={(e) => setRole(e.target.value as (typeof STAFF_ROLES)[number])}
        >
          {STAFF_ROLES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <ActionButton
        pending={pending}
        label="Grant role"
        onClick={() => {
          const subject = identitySubjectId.trim();
          if (!subject) return;
          void run(
            () => grantStaffRole({ identitySubjectId: subject, role, idempotencyKey }),
            "Staff role granted.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function RevokeStaffRoleForm({ identitySubjectId }: { identitySubjectId: string }) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        className="rounded border px-2 py-1 text-xs"
        onClick={() =>
          void run(
            () => revokeStaffRole({ identitySubjectId, idempotencyKey }),
            "Staff role revoked.",
          )
        }
      >
        Revoke
      </button>
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </div>
  );
}

type OrderLineOption = { orderLineId: string; label: string };

export function CancelOrderLineForm({
  orderLineOptions,
}: {
  orderLineOptions: OrderLineOption[];
}) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [orderLineId, setOrderLineId] = useState(orderLineOptions[0]?.orderLineId ?? "");
  const [editionId, setEditionId] = useState("");

  return (
    <FormSection title="Cancel after possession">
      <UuidFields
        pending={pending}
        orderLineId={orderLineId}
        setOrderLineId={setOrderLineId}
        editionId={editionId}
        setEditionId={setEditionId}
        orderLineOptions={orderLineOptions}
      />
      <ActionButton
        pending={pending}
        label="Cancel line"
        onClick={() => {
          if (!orderLineId.trim() || !editionId.trim()) return;
          void run(
            () =>
              cancelOrderAfterPossession({
                orderLineId: orderLineId.trim(),
                editionId: editionId.trim(),
                idempotencyKey,
              }),
            "Cancellation submitted.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function RefundOrderForm({
  orderId,
  orderLineOptions,
}: {
  orderId: string;
  orderLineOptions: OrderLineOption[];
}) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [amountPence, setAmountPence] = useState("");
  const [orderLineId, setOrderLineId] = useState("");

  return (
    <FormSection title="Request refund">
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">Amount (pence)</span>
        <input
          type="number"
          min={1}
          className={adminFormFieldClass}
          value={amountPence}
          disabled={pending}
          onChange={(e) => setAmountPence(e.target.value)}
        />
      </label>
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">Order line (optional)</span>
        <select
          className={adminFormFieldClass}
          value={orderLineId}
          disabled={pending}
          onChange={(e) => setOrderLineId(e.target.value)}
        >
          <option value="">Whole order</option>
          {orderLineOptions.map((line) => (
            <option key={line.orderLineId} value={line.orderLineId}>
              {line.label}
            </option>
          ))}
        </select>
      </label>
      <ActionButton
        pending={pending}
        label="Request refund"
        onClick={() => {
          const amount = Number(amountPence);
          if (!Number.isInteger(amount) || amount < 1) return;
          void run(
            () =>
              requestOrderRefund({
                orderId,
                amountPence: amount,
                ...(orderLineId ? { orderLineId } : {}),
                idempotencyKey,
              }),
            "Refund requested.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function CreateProductionTaskForm() {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [orderLineId, setOrderLineId] = useState("");
  const [editionId, setEditionId] = useState("");

  return (
    <FormSection title="Create production task">
      <PlainUuidField
        label="Order line ID"
        value={orderLineId}
        disabled={pending}
        onChange={setOrderLineId}
      />
      <PlainUuidField
        label="Edition ID"
        value={editionId}
        disabled={pending}
        onChange={setEditionId}
      />
      <ActionButton
        pending={pending}
        label="Create task"
        onClick={() => {
          if (!orderLineId.trim() || !editionId.trim()) return;
          void run(
            () =>
              createProductionTask({
                orderLineId: orderLineId.trim(),
                editionId: editionId.trim(),
                idempotencyKey,
              }),
            "Production task created.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function UpdateFulfilmentForm({ defaultFulfilmentId }: { defaultFulfilmentId?: string }) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [fulfilmentId, setFulfilmentId] = useState(defaultFulfilmentId ?? "");
  const [status, setStatus] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  return (
    <FormSection title="Update fulfilment">
      <PlainUuidField
        label="Fulfilment ID"
        value={fulfilmentId}
        disabled={pending}
        onChange={setFulfilmentId}
      />
      <PlainUuidField label="Status" value={status} disabled={pending} onChange={setStatus} />
      <PlainUuidField
        label="Carrier (optional)"
        value={carrier}
        disabled={pending}
        onChange={setCarrier}
      />
      <PlainUuidField
        label="Tracking number (optional)"
        value={trackingNumber}
        disabled={pending}
        onChange={setTrackingNumber}
      />
      <ActionButton
        pending={pending}
        label="Update"
        onClick={() => {
          if (!fulfilmentId.trim() || !status.trim()) return;
          void run(
            () =>
              updateFulfilment({
                fulfilmentId: fulfilmentId.trim(),
                status: status.trim(),
                ...(carrier.trim() ? { carrier: carrier.trim() } : {}),
                ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}),
                idempotencyKey,
              }),
            "Fulfilment updated.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function RecordPossessionForm({ defaultFulfilmentId }: { defaultFulfilmentId?: string }) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [fulfilmentId, setFulfilmentId] = useState(defaultFulfilmentId ?? "");
  const [status, setStatus] = useState("");
  const [possessionAt, setPossessionAt] = useState("");

  return (
    <FormSection title="Record possession">
      <PlainUuidField
        label="Fulfilment ID"
        value={fulfilmentId}
        disabled={pending}
        onChange={setFulfilmentId}
      />
      <PlainUuidField label="Status" value={status} disabled={pending} onChange={setStatus} />
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">Possession at (ISO date-time)</span>
        <input
          type="datetime-local"
          className={adminFormFieldClass}
          value={possessionAt}
          disabled={pending}
          onChange={(e) => setPossessionAt(e.target.value)}
        />
      </label>
      <ActionButton
        pending={pending}
        label="Record possession"
        onClick={() => {
          if (!fulfilmentId.trim() || !status.trim() || !possessionAt) return;
          const iso = new Date(possessionAt).toISOString();
          void run(
            () =>
              recordFulfilmentPossession({
                fulfilmentId: fulfilmentId.trim(),
                status: status.trim(),
                possessionAt: iso,
                idempotencyKey,
              }),
            "Possession recorded.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function MarkPayoutPaidRowAction({ payoutId }: { payoutId: string }) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [paidReference, setPaidReference] = useState("");

  return (
    <div className="min-w-[12rem] space-y-1">
      <input
        className="w-full rounded border px-2 py-1 text-xs"
        placeholder="Paid reference"
        value={paidReference}
        disabled={pending}
        onChange={(e) => setPaidReference(e.target.value)}
      />
      <button
        type="button"
        disabled={pending}
        className="rounded border px-2 py-1 text-xs"
        onClick={() => {
          if (!paidReference.trim()) return;
          void run(
            () =>
              markPayoutPaid({
                payoutId,
                paidReference: paidReference.trim(),
                idempotencyKey,
              }),
            "Payout marked paid.",
          );
        }}
      >
        Mark paid
      </button>
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </div>
  );
}

export function MarkPayoutPaidForm({ defaultPayoutId }: { defaultPayoutId?: string }) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [payoutId, setPayoutId] = useState(defaultPayoutId ?? "");
  const [paidReference, setPaidReference] = useState("");

  return (
    <FormSection title="Mark payout paid">
      <PlainUuidField
        label="Payout ID"
        value={payoutId}
        disabled={pending}
        onChange={setPayoutId}
      />
      <PlainUuidField
        label="Paid reference"
        value={paidReference}
        disabled={pending}
        onChange={setPaidReference}
      />
      <ActionButton
        pending={pending}
        label="Mark paid"
        onClick={() => {
          if (!payoutId.trim() || !paidReference.trim()) return;
          void run(
            () =>
              markPayoutPaid({
                payoutId: payoutId.trim(),
                paidReference: paidReference.trim(),
                idempotencyKey,
              }),
            "Payout marked paid.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function CreateStockHoldForm() {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [editionId, setEditionId] = useState("");
  const [clientPartyId, setClientPartyId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");

  return (
    <FormSection title="Create stock hold">
      <PlainUuidField
        label="Edition ID"
        value={editionId}
        disabled={pending}
        onChange={setEditionId}
      />
      <PlainUuidField
        label="Client party ID"
        value={clientPartyId}
        disabled={pending}
        onChange={setClientPartyId}
      />
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">Expires at</span>
        <input
          type="datetime-local"
          className={adminFormFieldClass}
          value={expiresAt}
          disabled={pending}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
      </label>
      <PlainUuidField label="Note (optional)" value={note} disabled={pending} onChange={setNote} />
      <ActionButton
        pending={pending}
        label="Create hold"
        onClick={() => {
          if (!editionId.trim() || !clientPartyId.trim() || !expiresAt) return;
          void run(
            () =>
              createStockHold({
                editionId: editionId.trim(),
                clientPartyId: clientPartyId.trim(),
                expiresAt: new Date(expiresAt).toISOString(),
                ...(note.trim() ? { note: note.trim() } : {}),
                idempotencyKey,
              }),
            "Hold created.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function ReleaseStockHoldForm({ holdId }: { holdId: string }) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        className="rounded border px-2 py-1 text-xs"
        onClick={() =>
          void run(() => releaseStockHold({ holdId, idempotencyKey }), "Hold released.")
        }
      >
        Release
      </button>
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </div>
  );
}

export function RecordThirdPartySaleForm() {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [editionId, setEditionId] = useState("");
  const [sellerPartyId, setSellerPartyId] = useState("");
  const [buyerPartyId, setBuyerPartyId] = useState("");
  const [grossPence, setGrossPence] = useState("");

  return (
    <FormSection title="Record third-party sale">
      <PlainUuidField
        label="Edition ID"
        value={editionId}
        disabled={pending}
        onChange={setEditionId}
      />
      <PlainUuidField
        label="Seller party ID"
        value={sellerPartyId}
        disabled={pending}
        onChange={setSellerPartyId}
      />
      <PlainUuidField
        label="Buyer party ID"
        value={buyerPartyId}
        disabled={pending}
        onChange={setBuyerPartyId}
      />
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">Gross (pence)</span>
        <input
          type="number"
          min={0}
          className={adminFormFieldClass}
          value={grossPence}
          disabled={pending}
          onChange={(e) => setGrossPence(e.target.value)}
        />
      </label>
      <ActionButton
        pending={pending}
        label="Record sale"
        onClick={() => {
          const gross = Number(grossPence);
          if (
            !editionId.trim() ||
            !sellerPartyId.trim() ||
            !buyerPartyId.trim() ||
            !Number.isInteger(gross) ||
            gross < 0
          ) {
            return;
          }
          void run(
            () =>
              recordThirdPartySale({
                editionId: editionId.trim(),
                sellerPartyId: sellerPartyId.trim(),
                buyerPartyId: buyerPartyId.trim(),
                grossPence: gross,
                idempotencyKey,
              }),
            "Sale recorded.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function ApproveSaleFeeForm() {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [feeId, setFeeId] = useState("");

  return (
    <FormSection title="Approve sale fee">
      <PlainUuidField label="Fee ID" value={feeId} disabled={pending} onChange={setFeeId} />
      <ActionButton
        pending={pending}
        label="Approve fee"
        onClick={() => {
          if (!feeId.trim()) return;
          void run(() => approveSaleFee({ feeId: feeId.trim(), idempotencyKey }), "Fee approved.");
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function CreateOriginalSaleForm() {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [artworkId, setArtworkId] = useState("");
  const [buyerPartyId, setBuyerPartyId] = useState("");
  const [salePricePence, setSalePricePence] = useState("");
  const [reservationExpiresAt, setReservationExpiresAt] = useState("");

  return (
    <FormSection title="Create original sale reservation">
      <PlainUuidField
        label="Artwork ID"
        value={artworkId}
        disabled={pending}
        onChange={setArtworkId}
      />
      <PlainUuidField
        label="Buyer party ID"
        value={buyerPartyId}
        disabled={pending}
        onChange={setBuyerPartyId}
      />
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">Sale price (pence)</span>
        <input
          type="number"
          min={0}
          className={adminFormFieldClass}
          value={salePricePence}
          disabled={pending}
          onChange={(e) => setSalePricePence(e.target.value)}
        />
      </label>
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">Reservation expires (optional)</span>
        <input
          type="datetime-local"
          className={adminFormFieldClass}
          value={reservationExpiresAt}
          disabled={pending}
          onChange={(e) => setReservationExpiresAt(e.target.value)}
        />
      </label>
      <ActionButton
        pending={pending}
        label="Create reservation"
        onClick={() => {
          const price = Number(salePricePence);
          if (!artworkId.trim() || !buyerPartyId.trim() || !Number.isInteger(price) || price < 0) {
            return;
          }
          void run(
            () =>
              createOriginalSale({
                artworkId: artworkId.trim(),
                buyerPartyId: buyerPartyId.trim(),
                salePricePence: price,
                ...(reservationExpiresAt
                  ? { reservationExpiresAt: new Date(reservationExpiresAt).toISOString() }
                  : {}),
                idempotencyKey,
              }),
            "Original sale created.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function ImportArtworkForm() {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [importKey, setImportKey] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [artistSlug, setArtistSlug] = useState("");
  const [artistDisplayName, setArtistDisplayName] = useState("");
  const [eligible, setEligible] = useState(true);

  return (
    <FormSection title="Import artwork">
      <PlainUuidField
        label="Import key"
        value={importKey}
        disabled={pending}
        onChange={setImportKey}
      />
      <PlainUuidField label="Slug" value={slug} disabled={pending} onChange={setSlug} />
      <PlainUuidField label="Title" value={title} disabled={pending} onChange={setTitle} />
      <PlainUuidField
        label="Artist slug"
        value={artistSlug}
        disabled={pending}
        onChange={setArtistSlug}
      />
      <PlainUuidField
        label="Artist display name"
        value={artistDisplayName}
        disabled={pending}
        onChange={setArtistDisplayName}
      />
      <label className={`${adminFormLabelClass} flex items-center gap-2`}>
        <input
          type="checkbox"
          checked={eligible}
          disabled={pending}
          onChange={(e) => setEligible(e.target.checked)}
        />
        <span className="text-neutral-600">Eligible for edition allocation</span>
      </label>
      <ActionButton
        pending={pending}
        label="Import"
        onClick={() => {
          if (
            !importKey.trim() ||
            !slug.trim() ||
            !title.trim() ||
            !artistSlug.trim() ||
            !artistDisplayName.trim()
          ) {
            return;
          }
          void run(
            () =>
              importArtwork({
                importKey: importKey.trim(),
                slug: slug.trim(),
                title: title.trim(),
                description: null,
                primaryImageUrl: null,
                artistSlug: artistSlug.trim(),
                artistDisplayName: artistDisplayName.trim(),
                eligibleForEditionAllocation: eligible,
                idempotencyKey,
              }),
            "Artwork imported.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function GrantSaleAuthorityForm({
  defaultOwnerPartyId,
  artworkOptions,
}: {
  defaultOwnerPartyId?: string;
  artworkOptions?: Array<{ artworkId: string; label: string }>;
}) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [artworkId, setArtworkId] = useState(artworkOptions?.[0]?.artworkId ?? "");
  const [ownerPartyId, setOwnerPartyId] = useState(defaultOwnerPartyId ?? "");
  const [authorisedCount, setAuthorisedCount] = useState(1);
  const [evidenceNote, setEvidenceNote] = useState("");

  return (
    <FormSection title="Grant sale authority">
      {artworkOptions?.length ? (
        <label className={adminFormLabelClass}>
          <span className="text-neutral-600">Artwork</span>
          <select
            className={adminFormFieldClass}
            value={artworkId}
            disabled={pending}
            onChange={(e) => setArtworkId(e.target.value)}
          >
            {artworkOptions.map((row) => (
              <option key={row.artworkId} value={row.artworkId}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <PlainUuidField
          label="Artwork ID"
          value={artworkId}
          disabled={pending}
          onChange={setArtworkId}
        />
      )}
      <PlainUuidField
        label="Owner party ID"
        value={ownerPartyId}
        disabled={pending || Boolean(defaultOwnerPartyId)}
        onChange={setOwnerPartyId}
      />
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">Authorised count (0–10)</span>
        <input
          type="number"
          min={0}
          max={10}
          className={adminFormFieldClass}
          value={authorisedCount}
          disabled={pending}
          onChange={(e) => setAuthorisedCount(Number(e.target.value))}
        />
      </label>
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">Evidence note</span>
        <textarea
          rows={2}
          className={adminFormFieldClass}
          value={evidenceNote}
          disabled={pending}
          onChange={(e) => setEvidenceNote(e.target.value)}
        />
      </label>
      <ActionButton
        pending={pending}
        label="Grant authority"
        onClick={() => {
          if (
            !artworkId.trim() ||
            !ownerPartyId.trim() ||
            !evidenceNote.trim() ||
            !Number.isInteger(authorisedCount) ||
            authorisedCount < 0 ||
            authorisedCount > 10
          ) {
            return;
          }
          void run(
            () =>
              grantArtworkSaleAuthority({
                artworkId: artworkId.trim(),
                ownerPartyId: ownerPartyId.trim(),
                authorisedCount,
                evidenceNote: evidenceNote.trim(),
                idempotencyKey,
              }),
            "Sale authority granted.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function LinkArtistIdentityForm({ artistId }: { artistId: string }) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [email, setEmail] = useState("");

  return (
    <FormSection title="Link login by email">
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">Email</span>
        <input
          type="email"
          className={adminFormFieldClass}
          value={email}
          disabled={pending}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <ActionButton
        pending={pending}
        label="Link identity"
        onClick={() => {
          const value = email.trim();
          if (!value) return;
          void run(
            () => linkArtistIdentity({ artistId, email: value, idempotencyKey }),
            "Identity linked.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function UnlinkArtistIdentityForm({ artistId }: { artistId: string }) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();

  return (
    <FormSection title="Unlink login">
      <ActionButton
        pending={pending}
        label="Unlink identity"
        onClick={() =>
          void run(() => unlinkArtistIdentity({ artistId, idempotencyKey }), "Identity unlinked.")
        }
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

export function AdjustMerchandiseStockForm() {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [variantId, setVariantId] = useState("");
  const [onHand, setOnHand] = useState("");

  return (
    <FormSection title="Adjust variant stock">
      <PlainUuidField
        label="Variant ID"
        value={variantId}
        disabled={pending}
        onChange={setVariantId}
      />
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">On hand</span>
        <input
          type="number"
          min={0}
          className={adminFormFieldClass}
          value={onHand}
          disabled={pending}
          onChange={(e) => setOnHand(e.target.value)}
        />
      </label>
      <ActionButton
        pending={pending}
        label="Adjust stock"
        onClick={() => {
          const qty = Number(onHand);
          if (!variantId.trim() || !Number.isInteger(qty) || qty < 0) return;
          void run(
            () =>
              adjustMerchandiseStock({
                variantId: variantId.trim(),
                onHand: qty,
                idempotencyKey,
              }),
            "Stock adjusted.",
          );
        }}
      />
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
    </FormSection>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={adminFormSectionClass}>
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function ActionButton({
  pending,
  label,
  onClick,
}: {
  pending: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="sm:col-span-2">
      <button
        type="button"
        disabled={pending}
        className="rounded border px-2 py-1 text-sm"
        onClick={onClick}
      >
        {pending ? "Working…" : label}
      </button>
    </div>
  );
}

function PlainUuidField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={adminFormLabelClass}>
      <span className="text-neutral-600">{label}</span>
      <input
        className={adminFormFieldClass}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function UuidFields({
  pending,
  orderLineId,
  setOrderLineId,
  editionId,
  setEditionId,
  orderLineOptions,
}: {
  pending: boolean;
  orderLineId: string;
  setOrderLineId: (value: string) => void;
  editionId: string;
  setEditionId: (value: string) => void;
  orderLineOptions: OrderLineOption[];
}) {
  return (
    <>
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">Order line</span>
        <select
          className={adminFormFieldClass}
          value={orderLineId}
          disabled={pending}
          onChange={(e) => setOrderLineId(e.target.value)}
        >
          {orderLineOptions.map((line) => (
            <option key={line.orderLineId} value={line.orderLineId}>
              {line.label}
            </option>
          ))}
        </select>
      </label>
      <PlainUuidField
        label="Edition ID"
        value={editionId}
        disabled={pending}
        onChange={setEditionId}
      />
    </>
  );
}
