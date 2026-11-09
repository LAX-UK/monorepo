"use client";

import {
  bookForClientAction,
  loadDeskClientLotsAction,
} from "@/lib/actions/admin/admin-collection-desk";
import {
  deskRefusalMessage,
  instantDayLabel,
  newAttemptKey,
} from "@/lib/admin/collections/desk.vm";
import { searchLegalEntityOptions } from "@/lib/admin/pickers/staff-entity-search";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import {
  ChoiceRow,
  EntityPicker,
  Field,
  FieldError,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffCheckbox,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
  TextInput,
  toast,
} from "@auction/staff-ui";
import type { DeskClientLot } from "@auction/types";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DeskOverrideField } from "./desk-override-field";
import { type ChosenSlot, DeskSlotChooser } from "./desk-slot-chooser";

type Errors = { fieldId: string; message: string }[];

type CollectorKind = "self" | "member" | "third_party";

const collectorKind = (value: string): CollectorKind =>
  value === "third_party" || value === "member" ? value : "self";

const F = {
  client: "book-client",
  lots: "book-lots",
  time: "book-time",
  name: "book-collector-name",
  authorised: "book-collector-authorised",
  reason: "book-reason",
} as const;

/**
 * Books a visit for a client who phoned or called in, through the same rules as the booking page:
 * only paid, cleared lots, one place, up to 20. A third party needs the client's say-so, ticked
 * here. Over capacity or inside the notice period needs a reason, recorded with the staff name.
 */
export function DeskBookForClientDialog({
  open,
  venueId,
  today,
  onClose,
}: {
  open: boolean;
  venueId: string;
  today: string;
  onClose: () => void;
}) {
  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Book for a client"
      description="For a client who phoned or called in. The same rules as the booking page apply."
      size="lg"
    >
      {open ? <BookForm venueId={venueId} today={today} onClose={onClose} /> : null}
    </StaffDialog>
  );
}

function BookForm({
  venueId,
  today,
  onClose,
}: {
  venueId: string;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [lots, setLots] = useState<DeskClientLot[] | null>(null);
  const [lotsFailed, setLotsFailed] = useState(false);
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [slot, setSlot] = useState<ChosenSlot>(null);
  const [kind, setKind] = useState<CollectorKind>("self");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [authorised, setAuthorised] = useState(false);
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  const [needsReason, setNeedsReason] = useState(false);
  const [errors, setErrors] = useState<Errors>([]);
  const [attempts, setAttempts] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newAttemptKey());
  const required = needsReason || slot?.full === true;
  const asked = override || required;
  const errorOf = (id: string) => errors.find((e) => e.fieldId === id)?.message;
  const clear = (id: string) => setErrors((list) => list.filter((e) => e.fieldId !== id));

  async function chooseClient(id: string | null) {
    setClientId(id);
    setLots(null);
    setTicked([]);
    setLotsFailed(false);
    clear(F.client);
    if (!id) return;
    const result = await loadDeskClientLotsAction(venueId, id);
    if (result.ok && result.data) {
      setLots(result.data);
      setTicked(result.data.filter((lot) => lot.collectable).map((lot) => lot.lotId));
    } else {
      setLotsFailed(true);
    }
  }

  async function submit() {
    const found: Errors = [];
    if (!clientId) found.push({ fieldId: F.client, message: "Choose the client." });
    else if (ticked.length === 0)
      found.push({ fieldId: F.lots, message: "Tick at least one lot." });
    if (!slot) found.push({ fieldId: F.time, message: "Choose a time." });
    if (name.trim().length < 2) {
      found.push({ fieldId: F.name, message: "Enter the name on their photo ID." });
    }
    if (kind === "third_party" && !authorised) {
      found.push({
        fieldId: F.authorised,
        message: "Tick that the client authorised them to collect.",
      });
    }
    if (asked && reason.trim().length < 3) {
      found.push({ fieldId: F.reason, message: "Give a reason: it is recorded with your name." });
    }
    if (found.length > 0 || !clientId || !slot) {
      setErrors(found);
      setAttempts((n) => n + 1);
      return;
    }
    setErrors([]);
    setFailure(null);
    setBusy(true);
    const result = await bookForClientAction({
      legalEntityId: clientId,
      lotIds: [...ticked],
      slotStart: slot.start,
      collector: {
        kind,
        name: name.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(kind === "third_party" && company.trim() ? { company: company.trim() } : {}),
        ...(kind === "third_party" ? { authorised: true } : {}),
      },
      ...(asked ? { override: { reason: reason.trim() } } : {}),
      idempotencyKey: key.current,
    });
    setBusy(false);
    if (result.ok) {
      toast.success(`Booked for ${instantDayLabel(slot.start)}`);
      onClose();
      router.refresh();
      return;
    }
    if (handleStaffStepUp(result)) return;
    key.current = newAttemptKey();
    if (result.errorCode === "slot_full" || result.errorCode === "notice_passed") {
      setNeedsReason(true);
      setErrors([
        { fieldId: F.reason, message: deskRefusalMessage(result.errorCode, result.error) },
      ]);
      setAttempts((n) => n + 1);
      return;
    }
    setFailure(deskRefusalMessage(result.errorCode, result.error, result.meta));
  }

  return (
    <div className="flex flex-col gap-4">
      <FormErrorSummary
        errors={errors}
        focusKey={attempts}
        title={`Check ${errors.length} ${errors.length === 1 ? "thing" : "things"} before booking`}
      />
      {failure ? (
        <Notice tone="danger" title={failure} alert>
          {null}
        </Notice>
      ) : null}

      <Field id={F.client} label="Client" error={errorOf(F.client)}>
        <EntityPicker
          value={clientId}
          onValueChange={(option) => void chooseClient(option?.id ?? null)}
          search={searchLegalEntityOptions}
          placeholder="Search for a client"
          searchPlaceholder="Search clients"
        />
      </Field>

      {clientId ? (
        <fieldset id={F.lots} tabIndex={-1} className="flex flex-col gap-2 outline-none">
          <legend className="text-staff-sm font-medium text-staff-fg">Lots to collect</legend>
          {lotsFailed ? (
            <Notice tone="danger" title="We couldn't load their lots">
              Choose the client again to retry.
            </Notice>
          ) : lots === null ? (
            <p className="text-staff-sm text-staff-muted">Loading their lots…</p>
          ) : lots.length === 0 ? (
            <p className="text-staff-sm text-staff-muted">
              This client has no works to collect from this place.
            </p>
          ) : (
            <ul className="flex flex-col">
              {lots.map((lot) => {
                const id = `book-lot-${lot.lotId}`;
                return (
                  <li key={lot.lotId}>
                    <ChoiceRow
                      htmlFor={id}
                      disabled={!lot.collectable}
                      control={
                        <StaffCheckbox
                          id={id}
                          disabled={!lot.collectable}
                          checked={ticked.includes(lot.lotId)}
                          onCheckedChange={(on) => {
                            clear(F.lots);
                            setTicked((current) =>
                              on === true
                                ? [...current, lot.lotId]
                                : current.filter((x) => x !== lot.lotId),
                            );
                          }}
                        />
                      }
                      label={
                        lot.lotNumber !== null ? `Lot ${lot.lotNumber} · ${lot.title}` : lot.title
                      }
                      description={lot.blockedMessage ?? undefined}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {errorOf(F.lots) ? <FieldError>{errorOf(F.lots)}</FieldError> : null}
        </fieldset>
      ) : null}

      <div id={F.time} tabIndex={-1} className="outline-none">
        <DeskSlotChooser
          venueId={venueId}
          initialDate={today}
          value={slot?.start ?? null}
          error={errorOf(F.time)}
          onChange={(next) => {
            setSlot(next);
            clear(F.time);
          }}
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-staff-sm font-medium text-staff-fg">Who collects</legend>
        <StaffRadioGroup
          aria-label="Who collects"
          value={kind}
          onValueChange={(value) => setKind(collectorKind(value))}
        >
          <ChoiceRow
            htmlFor="book-kind-self"
            control={<StaffRadio id="book-kind-self" value="self" />}
            label="The client"
          />
          <ChoiceRow
            htmlFor="book-kind-member"
            control={<StaffRadio id="book-kind-member" value="member" />}
            label="A named member"
            description="Someone who belongs to the client's organisation."
          />
          <ChoiceRow
            htmlFor="book-kind-third"
            control={<StaffRadio id="book-kind-third" value="third_party" />}
            label="Someone else"
            description="A colleague, a friend or a shipper."
          />
        </StaffRadioGroup>
        <Field id={F.name} label="Name on their photo ID" error={errorOf(F.name)}>
          <TextInput
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clear(F.name);
            }}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Email"
          optional
          description="We send them the time and place, never the price."
        >
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </Field>
        {kind === "third_party" ? (
          <>
            <Field label="Company" optional>
              <TextInput
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-start gap-3">
                <StaffCheckbox
                  id={F.authorised}
                  checked={authorised}
                  onCheckedChange={(on) => {
                    setAuthorised(on === true);
                    clear(F.authorised);
                  }}
                  className="mt-0.5"
                />
                <label htmlFor={F.authorised} className="text-staff-sm text-staff-fg">
                  The client has authorised this person to collect. This is recorded with your name
                  as their written authorisation.
                </label>
              </div>
              {errorOf(F.authorised) ? <FieldError>{errorOf(F.authorised)}</FieldError> : null}
            </div>
          </>
        ) : null}
      </fieldset>

      <DeskOverrideField
        id={F.reason}
        checked={override}
        required={required}
        onCheckedChange={setOverride}
        reason={reason}
        onReasonChange={(next) => {
          setReason(next);
          clear(F.reason);
        }}
        error={errorOf(F.reason)}
      />

      <div className="flex flex-wrap justify-end gap-2">
        <StaffButton variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </StaffButton>
        <StaffButton variant="primary" onClick={submit} loading={busy}>
          Book for a client
        </StaffButton>
      </div>
    </div>
  );
}
