"use client";

import { FramingOptionDialog } from "@/components/framing/framing-option-dialog.client";
import { useAdminAction } from "@/components/use-admin-action.client";
import { setFramingOptionOffered } from "@/server/application/framing-actions.server";
import {
  type FramingRowAction,
  frameSwatchColour,
  framingDetails,
  framingLeadTime,
  framingRowActions,
  framingUsedOn,
  pauseDescription,
  placeholderSummary,
  presentFramingStatus,
} from "@/server/domain/framing-catalogue.vm";
import type { FramingOption } from "@auction/shop-contracts";
import { FRAMING_BAND_CODES, framingBandLabel } from "@auction/shop-domain";
import {
  ConfirmActionDialog,
  type DataColumn,
  DataTable,
  EmptyState,
  MappedStatusBadge,
  Notice,
  type OverflowAction,
  PageHeader,
  PrimaryCell,
  StaffButton,
  ViewOnlyBadge,
  formatStaffMoney,
  rowActionsColumn,
} from "@auction/staff-ui";
import { Frame, Pause, Pencil, Play, Plus } from "@auction/staff-ui/icons";
import { useCallback, useMemo, useState } from "react";

type Dialog =
  | { kind: "edit"; option: FramingOption }
  | { kind: "new" }
  /** Offer or pause: asks first, since either changes what editions can show. */
  | { kind: "toggle"; option: FramingOption };

function OfferedToggle({
  option,
  offered,
  onClose,
}: {
  option: FramingOption;
  offered: boolean;
  onClose: () => void;
}) {
  const action = useAdminAction();
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={offered ? `Offer ${option.name}?` : `Pause ${option.name}?`}
        description={
          offered
            ? "Editions can offer it again. Nothing changes on an edition until its framing is saved."
            : pauseDescription(option)
        }
        confirmLabel={offered ? "Offer option" : "Pause option"}
        loading={action.pending}
        onConfirm={async () => {
          const ok = await action.run(
            () =>
              setFramingOptionOffered({
                optionId: option.id,
                offered,
                expectedVersion: option.version,
                idempotencyKey: action.idempotencyKey,
              }),
            offered ? `${option.name} is offered` : `${option.name} is paused`,
            offered ? "offer this framing option" : "pause this framing option",
          );
          if (ok) onClose();
        }}
      >
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}

/**
 * The framing catalogue: the options LAX Shop can offer, each with its details, lead time, price
 * for every size band, status and the editions using it. Staff with catalogue edit rights add,
 * edit, pause and offer options; everyone else sees the same list with nothing to change.
 */
export function FramingCatalogue({
  options,
  canEdit,
  viewOnlyRole,
}: {
  options: readonly FramingOption[];
  canEdit: boolean;
  /** The signed-in role's name, shown beside the title when the list is read-only. */
  viewOnlyRole?: string;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);
  const waiting = placeholderSummary(options);

  const actionsFor = useCallback(
    (option: FramingOption): OverflowAction[] =>
      framingRowActions(option, { canEdit }).map((action: FramingRowAction): OverflowAction => {
        switch (action.kind) {
          case "edit":
            return {
              id: "edit",
              label: "Edit option",
              icon: Pencil,
              onSelect: () => setDialog({ kind: "edit", option }),
            };
          case "pause":
            return {
              id: "pause",
              label: "Pause option…",
              icon: Pause,
              onSelect: () => setDialog({ kind: "toggle", option }),
            };
          case "offer":
            return {
              id: "offer",
              label: "Offer option…",
              icon: Play,
              onSelect: () => setDialog({ kind: "toggle", option }),
              ...(action.blockedReason
                ? { disabled: true, disabledReason: action.blockedReason }
                : {}),
            };
        }
      }),
    [canEdit],
  );

  const columns = useMemo<DataColumn<FramingOption>[]>(
    () => [
      {
        id: "option",
        header: "Option",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell secondary={framingDetails(row)}>
            <span
              aria-hidden
              className="mr-2.5 inline-block size-4 rounded-staff-xs align-[-3px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]"
              style={{ backgroundColor: frameSwatchColour(row.frame) }}
            />
            {row.name}
          </PrimaryCell>
        ),
      },
      {
        id: "leadTime",
        header: "Lead time",
        width: "168px",
        hideBelow: "lg",
        mobile: "meta",
        truncate: false,
        cell: (row) => framingLeadTime(row),
      },
      ...FRAMING_BAND_CODES.map(
        (band): DataColumn<FramingOption> => ({
          id: band,
          header: framingBandLabel(band),
          width: "132px",
          numeric: true,
          mobile: "meta",
          truncate: false,
          cell: (row) => (
            <>
              <span className="md:hidden">{framingBandLabel(band)} </span>
              {formatStaffMoney(row.pricesPence[band])}
              {row.placeholderBands.includes(band) ? (
                <span className="block text-staff-xs font-normal text-staff-muted">
                  Placeholder
                </span>
              ) : null}
            </>
          ),
        }),
      ),
      {
        id: "status",
        header: "Status",
        width: "112px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.status} present={presentFramingStatus} />,
      },
      {
        id: "usedOn",
        header: "Used on",
        width: "120px",
        hideBelow: "xl",
        mobile: "meta",
        truncate: false,
        cell: (row) => framingUsedOn(row) ?? <span className="text-staff-muted">None</span>,
      },
      ...(canEdit
        ? [
            rowActionsColumn<FramingOption>({
              actions: actionsFor,
              label: (row) => `Actions for ${row.name}`,
            }),
          ]
        : []),
    ],
    [canEdit, actionsFor],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Framing"
        description="The framing options LAX Shop offers. Each edition chooses which of these to offer. Prices include VAT."
        {...(!canEdit && viewOnlyRole ? { status: <ViewOnlyBadge role={viewOnlyRole} /> } : {})}
        {...(canEdit
          ? {
              primaryAction: (
                <StaffButton
                  variant="primary"
                  icon={<Plus aria-hidden />}
                  onClick={() => setDialog({ kind: "new" })}
                >
                  New framing option
                </StaffButton>
              ),
            }
          : {})}
      />
      {waiting.length > 0 ? (
        <Notice tone="info" title="Placeholder prices">
          <p>
            Replace each with the framer's price, or confirm it where it is already right, before
            any edition offers framing in production. An option can be offered once every size has a
            price of its own.
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-0.5 pl-5">
            {waiting.map((option) => (
              <li key={option.id}>
                <span className="font-medium">{option.name}</span>: {option.bands.join(", ")}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}
      <DataTable<FramingOption>
        label="Framing options"
        columns={columns}
        data={options}
        getRowId={(row) => row.id}
        density="comfortable"
        stickyToolbar={false}
        {...(canEdit
          ? { onRowOpen: (row: FramingOption) => setDialog({ kind: "edit", option: row }) }
          : {})}
        empty={
          <EmptyState
            illustration="plinth"
            title="No framing options yet"
            description="Add the framing LAX Shop offers: frame, mount, glazing, a price for each size and a lead time. Editions then choose which to offer."
            {...(canEdit
              ? {
                  action: (
                    <StaffButton
                      variant="secondary"
                      icon={<Plus aria-hidden />}
                      onClick={() => setDialog({ kind: "new" })}
                    >
                      New framing option
                    </StaffButton>
                  ),
                }
              : {})}
          />
        }
      />
      <p className="flex items-center gap-2 text-staff-xs text-staff-muted">
        <Frame aria-hidden className="size-3.5 shrink-0" />
        Larger than 80 × 100 cm: framing is quoted. Lead times are working days, added to the
        delivery or collection date.
      </p>
      {dialog?.kind === "new" ? <FramingOptionDialog option={null} onClose={close} /> : null}
      {dialog?.kind === "edit" ? (
        <FramingOptionDialog option={dialog.option} onClose={close} />
      ) : null}
      {dialog?.kind === "toggle" ? (
        <OfferedToggle
          option={dialog.option}
          offered={dialog.option.status !== "active"}
          onClose={close}
        />
      ) : null}
    </div>
  );
}
