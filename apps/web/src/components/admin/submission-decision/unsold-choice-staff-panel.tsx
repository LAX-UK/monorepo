"use client";

import {
  StaffMoneyField,
  StaffRadioField,
  StaffTextAreaField,
} from "@/components/admin/forms/staff-form-fields";
import {
  adminDecideUnsoldChoiceAction,
  adminSetRelistReserveFloorAction,
} from "@/lib/actions/admin-consignment-after-sale";
import {
  STAFF_UNSOLD_CHOICE_OPTIONS,
  type UnsoldChoiceFormValues,
  unsoldChoiceDecisionBody,
  unsoldChoiceFormDefaults,
  unsoldChoiceFormSchema,
} from "@/lib/admin/submissions/unsold-choice-form";
import { STAFF_PARSE_PARAMS } from "@/lib/forms/staff-error-map";
import { sellerMoney } from "@/lib/seller/consignment-agreement-view";
import { unsoldChoiceSummary } from "@/lib/seller/unsold-choice-view";
import { formatDate } from "@/lib/ui/format";
import { notify } from "@/lib/ui/notify";
import {
  FormActions,
  type KeyValueItem,
  KeyValueList,
  Notice,
  Section,
  StaffButton,
} from "@auction/staff-ui";
import type { StaffAfterSaleView } from "@auction/types";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { RELIST_FLOOR_FORM_ID, UNSOLD_CHOICE_DECISION_FORM_ID } from "./form-ids";

type Unsold = NonNullable<StaffAfterSaleView["unsold"]>;

type Props = {
  submissionId: string;
  unsold: Unsold;
};

const floorSchema = z.object({ floor: z.string() });

function facts(unsold: Unsold): KeyValueItem[] {
  const { choice, currency } = unsold;
  const money = (value: string | null) => (value ? sellerMoney(value, currency) : null);
  return [
    {
      label: "Seller asked",
      value: choice?.requestedChoice
        ? unsoldChoiceSummary(choice.requestedChoice, choice.requestedReserve, currency)
        : "Not chosen yet",
    },
    ...(choice?.requestedAt
      ? [
          {
            label: "Asked by",
            value: `${choice.requestedByName ?? "The seller"}, ${formatDate(choice.requestedAt)}`,
          },
        ]
      : []),
    {
      label: "Reserve when it ended",
      value: money(unsold.currentReserve) ?? "No reserve",
      numeric: true,
    },
    {
      label: "Lowest reserve for a relist",
      value: money(unsold.reserveFloor) ?? "Not set",
      numeric: true,
    },
  ];
}

function FloorForm({ submissionId, floor }: { submissionId: string; floor: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof floorSchema>>({
    resolver: zodResolver(floorSchema, STAFF_PARSE_PARAMS),
    defaultValues: { floor: floor ?? "" },
  });
  const failure = form.formState.errors.root?.server?.message;
  return (
    <form
      id={RELIST_FLOOR_FORM_ID}
      noValidate
      aria-label="Lowest reserve for a relist"
      className="flex flex-col gap-3"
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          const r = await adminSetRelistReserveFloorAction(submissionId, values.floor || null);
          if (r.ok) {
            notify.success("Lowest reserve saved");
            form.reset(values);
            router.refresh();
            return;
          }
          form.setError("root.server", { type: "server", message: r.error });
        }),
      )}
    >
      {failure ? (
        <Notice tone="danger" alert title="It was not saved">
          {failure}
        </Notice>
      ) : null}
      <StaffMoneyField
        control={form.control}
        formId={RELIST_FLOOR_FORM_ID}
        name="floor"
        label="Lowest reserve for a relist"
        description="The seller cannot ask for a relist reserve below this. Leave empty for no floor."
        optional
        disabled={pending}
      />
      <FormActions>
        <StaffButton
          type="submit"
          variant="secondary"
          loading={pending}
          disabled={!form.formState.isDirty}
        >
          Save lowest reserve
        </StaffButton>
      </FormActions>
    </form>
  );
}

function DecisionForm({ submissionId, unsold }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<UnsoldChoiceFormValues>({
    resolver: zodResolver(unsoldChoiceFormSchema, STAFF_PARSE_PARAMS),
    defaultValues: unsoldChoiceFormDefaults(unsold.choice),
    mode: "onSubmit",
  });
  const choice = form.watch("choice");
  const failure = form.formState.errors.root?.server?.message;
  const fieldProps = { control: form.control, formId: UNSOLD_CHOICE_DECISION_FORM_ID } as const;
  const requested = Boolean(unsold.choice?.requestedChoice);

  return (
    <form
      id={UNSOLD_CHOICE_DECISION_FORM_ID}
      noValidate
      aria-label="Confirm what happens next"
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          const r = await adminDecideUnsoldChoiceAction(
            submissionId,
            unsoldChoiceDecisionBody(values),
          );
          if (r.ok) {
            notify.success("Confirmed. The seller has been told.");
            router.refresh();
            return;
          }
          form.setError("root.server", { type: "server", message: r.error });
        }),
      )}
    >
      {failure ? (
        <Notice tone="danger" alert title="It was not confirmed">
          {failure}
        </Notice>
      ) : null}
      <StaffRadioField
        {...fieldProps}
        name="choice"
        label="What happens next"
        options={STAFF_UNSOLD_CHOICE_OPTIONS}
        disabled={pending}
      />
      {choice === "relist" ? (
        <StaffMoneyField
          {...fieldProps}
          name="reserve"
          label="New reserve"
          description="Leave empty to keep the reserve it ended with."
          optional
          disabled={pending}
        />
      ) : null}
      <StaffTextAreaField
        {...fieldProps}
        name="note"
        label="Note to the seller"
        description={
          requested
            ? "Needed when you confirm something other than what the seller asked. Sent as written."
            : "Sent to the seller as written."
        }
        optional
        rows={3}
        disabled={pending}
      />
      <FormActions>
        <StaffButton type="submit" variant="primary" loading={pending}>
          Confirm and tell the seller
        </StaffButton>
      </FormActions>
    </form>
  );
}

/**
 * After the sale, for a lot that did not sell: what the seller asked for, the lowest reserve
 * they may ask for a relist, and the specialist's confirmation, which the seller is told about.
 */
export function UnsoldChoiceStaffPanel({ submissionId, unsold }: Props) {
  const confirmed = unsold.choice?.status === "confirmed" ? unsold.choice : null;
  return (
    <Section
      title="After the sale"
      description="The lot did not sell. The seller chooses what happens next and you confirm it."
      bodyClassName="flex flex-col gap-5"
    >
      <KeyValueList items={facts(unsold)} />
      {confirmed?.decidedChoice ? (
        <Notice
          tone="success"
          title={`Confirmed: ${unsoldChoiceSummary(confirmed.decidedChoice, confirmed.decidedReserve, confirmed.currency)}`}
          actions={
            <StaffButton asChild size="sm" variant="secondary">
              <Link href={`/admin/lots/${unsold.lotId}`}>Open lot</Link>
            </StaffButton>
          }
        >
          {confirmed.staffNote
            ? `Note to the seller: ${confirmed.staffNote}`
            : `By ${confirmed.decidedByName ?? "a specialist"}${confirmed.decidedAt ? `, ${formatDate(confirmed.decidedAt)}` : ""}.`}
        </Notice>
      ) : (
        <>
          <FloorForm submissionId={submissionId} floor={unsold.reserveFloor} />
          <DecisionForm submissionId={submissionId} unsold={unsold} />
        </>
      )}
    </Section>
  );
}
