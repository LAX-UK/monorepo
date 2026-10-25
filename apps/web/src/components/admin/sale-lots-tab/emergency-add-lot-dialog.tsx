"use client";

import { StaffImageCollection } from "@/components/admin/media/staff-image-collection";
import {
  LotWindowFields,
  isoToFormString,
} from "@/components/admin/sale-lots-tab/lot-window-fields";
import { searchAdminLegalEntitiesBrowseAction } from "@/lib/actions/admin-legal-entities-browse";
import { adminAddLotToSaleResultAction } from "@/lib/actions/admin-sales";
import { deliveryModeExplanation } from "@/lib/admin/sale-setup/field-copy";
import { formatSaleSetupActionError } from "@/lib/admin/sale-setup/format-sale-setup-action-error";
import {
  type EmergencyAddLotFormValues,
  emptyEmergencyAddLotRow,
  safeParseEmergencyAddLotForApi,
} from "@/lib/admin/sale-setup/lot-row-schema";
import { notify } from "@/lib/ui/notify";
import {
  EntityMultiPicker,
  type EntityOption,
  EntityPicker,
  EnumSelect,
  Field,
  FormErrorSummary,
  MoneyInput,
  Notice,
  StaffButton,
  StaffDialog,
  TextArea,
  TextInput,
  staffButtonVariants,
} from "@auction/staff-ui";
import type { CategoryNode, LotAuctionType, SaleDeliveryMode, SaleStatus } from "@auction/types";
import { lotAuctionTypes } from "@auction/types";
import { getSaleModeCapabilities } from "@auction/validators";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";

const FORM_ID = "emergency-add-lot";

/** The id of a field's control, for the error summary's links. */
const fieldId = (key: string) => `${FORM_ID}-${key}`;

const AUCTION_TYPE_LABELS: Record<LotAuctionType, string> = {
  english: "English (ascending bids)",
  dutch: "Dutch (descending price)",
  sealed: "Sealed bid",
  buy_it_now: "Buy it now",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  saleStatus: SaleStatus;
  deliveryMode: SaleDeliveryMode;
  saleStartTime: Date;
  saleEndTime: Date;
  categories: CategoryNode[];
  englishOnlyAuctionsLocked: boolean;
  /** After the lot is added; the page refreshes unless this navigates. */
  onAdded: () => void;
};

type Draft = {
  title: string;
  description: string;
  images: string[];
  seller: EntityOption | null;
  categoryIds: string[];
  auctionType: LotAuctionType;
  startingPence: number | null;
  start: string | null;
  end: string | null;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  images: [],
  seller: null,
  categoryIds: [],
  auctionType: "english",
  startingPence: null,
  start: null,
  end: null,
};

type FieldKey =
  | "title"
  | "description"
  | "images"
  | "sellerLegalEntityId"
  | "categoryIds"
  | "auctionType"
  | "startingPrice"
  | "startTime"
  | "endTime";

function flattenCategories(nodes: CategoryNode[], parent = ""): EntityOption[] {
  return nodes.flatMap((node) => {
    const path = parent ? `${parent} / ${node.name}` : node.name;
    return [{ id: node.id, label: path }, ...flattenCategories(node.children ?? [], path)];
  });
}

async function searchSellers(query: string): Promise<EntityOption[]> {
  const result = await searchAdminLegalEntitiesBrowseAction({
    ...(query ? { q: query } : {}),
    limit: 25,
    offset: 0,
  });
  if (!result.ok) throw new Error(result.error || "Search failed");
  return (result.data?.rows ?? []).map((row) => ({ id: row.id, label: row.displayName }));
}

/**
 * Adds a new lot to a scheduled or live sale. The catalogue details are required up front because
 * the lot is scheduled as soon as it is saved. Checked on submit and again on every change after
 * that; a failure stays in the dialog with what was entered.
 */
export function EmergencyAddLotDialog({
  open,
  onOpenChange,
  saleId,
  saleStatus,
  deliveryMode,
  saleStartTime,
  saleEndTime,
  categories,
  englishOnlyAuctionsLocked,
  onAdded,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = useState(false);
  /** Counts failed submits, so the error summary takes focus once per attempt. */
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [failure, setFailure] = useState<{ message: string; savedLotId: string | null } | null>(
    null,
  );
  const [busy, startTransition] = useTransition();
  const inheritsTiming = getSaleModeCapabilities(deliveryMode).inheritsLotTiming;
  const categoryOptions = useMemo(() => flattenCategories(categories), [categories]);
  const auctionTypeOptions = useMemo(
    () =>
      (englishOnlyAuctionsLocked ? (["english"] as const) : lotAuctionTypes).map((value) => ({
        value,
        label: AUCTION_TYPE_LABELS[value],
      })),
    [englishOnlyAuctionsLocked],
  );
  const ctx = useMemo(
    () => ({ saleStartTime, saleEndTime, deliveryMode, englishOnlyAuctionsLocked }),
    [deliveryMode, englishOnlyAuctionsLocked, saleEndTime, saleStartTime],
  );

  const patch = (next: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...next }));

  const parsed = useMemo(() => {
    const values: EmergencyAddLotFormValues = {
      ...emptyEmergencyAddLotRow("emergency-add"),
      title: draft.title,
      description: draft.description,
      images: draft.images,
      sellerLegalEntityId: draft.seller?.id ?? "",
      categoryIds: draft.categoryIds,
      auctionType: draft.auctionType,
      startingPrice: draft.startingPence === null ? "" : (draft.startingPence / 100).toFixed(2),
      startTime: isoToFormString(draft.start),
      endTime: isoToFormString(draft.end),
    };
    return safeParseEmergencyAddLotForApi(values, ctx);
  }, [draft, ctx]);

  const errors: Partial<Record<FieldKey, string>> = {};
  const otherProblems: string[] = [];
  if (submitted && !parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "") as FieldKey;
      if (key in FIELD_KEYS) {
        if (!errors[key]) errors[key] = issue.message;
      } else otherProblems.push(issue.message);
    }
  }

  const close = (next: boolean) => {
    if (busy) return;
    if (!next) {
      setDraft(EMPTY_DRAFT);
      setSubmitted(false);
      setFailedSubmits(0);
      setFailure(null);
    }
    onOpenChange(next);
  };

  const submit = () => {
    setSubmitted(true);
    setFailure(null);
    if (!parsed.success) {
      setFailedSubmits((n) => n + 1);
      return;
    }
    const payload = parsed.data;
    startTransition(async () => {
      const result = await adminAddLotToSaleResultAction(saleId, payload);
      if (!result.ok) {
        const lotId = typeof result.meta?.lotId === "string" ? result.meta.lotId : null;
        const rolledBack = result.meta?.rolledBack === true;
        setFailure({
          message: formatSaleSetupActionError(result),
          savedLotId: rolledBack ? lotId : null,
        });
        return;
      }
      notify.success(
        saleStatus === "active" ? "Lot added to the live sale" : "Lot added and scheduled",
      );
      setDraft(EMPTY_DRAFT);
      setSubmitted(false);
      onOpenChange(false);
      onAdded();
    });
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={close}
      size="md"
      title={`Add a lot to the ${saleStatus === "active" ? "live" : "scheduled"} sale`}
      description="The lot is scheduled as soon as it is saved, so the catalogue description and at least one image are required."
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => close(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={FORM_ID} variant="primary" loading={busy}>
            Add lot to sale
          </StaffButton>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormErrorSummary
          focusKey={failedSubmits}
          errors={FIELD_ORDER.flatMap((key) => {
            const message = errors[key];
            return message ? [{ fieldId: fieldId(key), message }] : [];
          })}
        />
        {failure ? (
          <Notice
            tone="danger"
            alert
            title="That did not go through"
            {...(failure.savedLotId
              ? {
                  actions: (
                    <Link
                      href={`/admin/lots/${failure.savedLotId}`}
                      className={staffButtonVariants({ variant: "secondary", size: "sm" })}
                    >
                      Open the saved lot
                    </Link>
                  ),
                }
              : {})}
          >
            {failure.message}
            {failure.savedLotId
              ? " The lot was saved as standalone inventory; open it to fix the problem and try again."
              : ""}
          </Notice>
        ) : null}
        {otherProblems.length > 0 ? (
          <Notice tone="danger" alert title="Check the lot details">
            {otherProblems.join(" ")}
          </Notice>
        ) : null}
        <Notice tone="info" title="How bidding works in this sale">
          {deliveryModeExplanation(deliveryMode)}
        </Notice>

        <Field id={fieldId("title")} label="Title" error={errors.title} disabled={busy}>
          <TextInput
            value={draft.title}
            maxLength={500}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </Field>
        <Field
          id={fieldId("description")}
          label="Description"
          description="The catalogue description bidders read."
          error={errors.description}
          disabled={busy}
        >
          <TextArea
            rows={4}
            value={draft.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </Field>
        <Field id={fieldId("images")} label="Photos" error={errors.images} disabled={busy}>
          <StaffImageCollection
            kind="lot_image"
            value={draft.images.map((key) => ({ key }))}
            onChange={(next) => patch({ images: next.map((entry) => entry.key) })}
            noun="photo"
            primaryLabel="Main"
            uploadLabel={draft.images.length === 0 ? "Upload photos" : "Add photos"}
            disabled={busy}
            maxFiles={50}
          />
        </Field>
        <Field
          id={fieldId("sellerLegalEntityId")}
          label="Seller"
          error={errors.sellerLegalEntityId}
          disabled={busy}
        >
          <EntityPicker
            value={draft.seller?.id ?? null}
            selected={draft.seller}
            onValueChange={(seller) => patch({ seller })}
            search={searchSellers}
            placeholder="Choose the seller"
            searchPlaceholder="Search by organisation or entity name"
            emptyText="No sellers match."
          />
        </Field>
        <Field
          id={fieldId("categoryIds")}
          label="Categories"
          description="Up to 8."
          error={errors.categoryIds}
          disabled={busy}
        >
          <EntityMultiPicker
            value={draft.categoryIds}
            onValueChange={(categoryIds) => patch({ categoryIds })}
            options={categoryOptions}
            max={8}
            placeholder="Add a category"
            searchPlaceholder="Search categories"
            emptyText="No categories match."
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={fieldId("auctionType")}
            label="Auction type"
            error={errors.auctionType}
            disabled={busy}
          >
            <EnumSelect<LotAuctionType>
              value={draft.auctionType}
              onValueChange={(auctionType) => patch({ auctionType })}
              options={auctionTypeOptions}
              disabled={busy || englishOnlyAuctionsLocked}
            />
          </Field>
          <Field
            id={fieldId("startingPrice")}
            label="Starting price"
            error={errors.startingPrice}
            disabled={busy}
          >
            <MoneyInput
              value={draft.startingPence}
              onValueChange={(startingPence) => patch({ startingPence })}
            />
          </Field>
        </div>
        {inheritsTiming ? null : (
          <LotWindowFields
            start={draft.start}
            end={draft.end}
            onStartChange={(start) => patch({ start })}
            onEndChange={(end) => patch({ end })}
            startError={errors.startTime}
            endError={errors.endTime}
            disabled={busy}
            idPrefix={FORM_ID}
          />
        )}
      </form>
    </StaffDialog>
  );
}

/** The order the fields appear in, for the error summary. */
const FIELD_ORDER: readonly FieldKey[] = [
  "title",
  "description",
  "images",
  "sellerLegalEntityId",
  "categoryIds",
  "auctionType",
  "startingPrice",
  "startTime",
  "endTime",
];

const FIELD_KEYS: Record<FieldKey, true> = {
  title: true,
  description: true,
  images: true,
  sellerLegalEntityId: true,
  categoryIds: true,
  auctionType: true,
  startingPrice: true,
  startTime: true,
  endTime: true,
};
