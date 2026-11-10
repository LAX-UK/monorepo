"use client";

import { saveCollectionSettingsAction } from "@/lib/actions/admin/admin-collections";
import {
  COLLECTION_VISIT_MINUTES,
  type SettingsDraft,
  bodyFromDraft,
  draftFromSettings,
  isDirty,
  validateSettingsDraft,
} from "@/lib/admin/collections/collection-forms";
import { RULE_ISSUE_MESSAGES } from "@/lib/admin/collections/collections.vm";
import { notify } from "@/lib/ui/notify";
import {
  ChoiceRow,
  EnumSelect,
  Field,
  FieldRow,
  FormActions,
  FormErrorSummary,
  FormSection,
  Notice,
  StaffButton,
  StaffSwitch,
  TextInput,
  UnsavedChangesGuard,
} from "@auction/staff-ui";
import type { StaffCollectionSettings } from "@auction/types";
import type { AffectedBookingsChoice } from "@auction/validators";
import { useCallback, useId, useMemo, useState } from "react";
import { AffectedBookingsDialog } from "./affected-bookings-dialog";
import { HoursEditor } from "./hours-editor";
import { useCollectionChange } from "./use-collection-change";

type Props = {
  settings: StaffCollectionSettings;
  canChange: boolean;
};

const VISIT_OPTIONS = COLLECTION_VISIT_MINUTES.map((minutes) => ({
  value: String(minutes),
  label: `${minutes} minutes`,
}));

/**
 * The weekly hours and the rules that decide which visits clients can book, and the switch that
 * turns online booking on. Saved together. A save that would leave booked visits outside the new
 * hours or rules first lists them and asks what to do; it never cancels on its own.
 */
export function HoursRulesForm({ settings, canChange }: Props) {
  const ids = useId();
  const [draft, setDraft] = useState<SettingsDraft>(() => draftFromSettings(settings));
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [saved, setSaved] = useState(settings);

  const errors = useMemo(() => validateSettingsDraft(draft), [draft]);
  const shown = attempted ? errors : { rules: {}, hours: {}, count: 0 };
  const dirty = isDirty(draft, saved);

  const send = useCallback(
    (choice: AffectedBookingsChoice | undefined) =>
      saveCollectionSettingsAction(settings.venueId, {
        ...bodyFromDraft(draft, saved.version),
        ...(choice ? { affectedBookings: choice } : {}),
      }),
    [settings.venueId, draft, saved.version],
  );
  const change = useCollectionChange(send, (result) => {
    setSaved(result.settings);
    setDraft(draftFromSettings(result.settings));
    setAttempted(false);
    notify.success(
      result.cancelled > 0
        ? `Saved. ${result.cancelled} ${result.cancelled === 1 ? "visit" : "visits"} cancelled.`
        : "Collection settings saved.",
    );
  });

  const set = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const field = (name: string) => `${ids}-${name}`;
  const summary = [
    ...(Object.entries(shown.rules) as [string, string][]).map(([key, message]) => ({
      fieldId: field(key),
      message: message || RULE_ISSUE_MESSAGES[key as keyof typeof RULE_ISSUE_MESSAGES],
    })),
    ...Object.keys(shown.hours).map((key) => ({
      fieldId: `${key}-opens`,
      message: "Fix the opening hours marked below.",
    })),
  ];
  const locked = !canChange || change.busy;

  function submit() {
    setAttempted(true);
    if (errors.count > 0) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    void change.submit();
  }

  return (
    <form
      noValidate
      aria-label="Hours and rules"
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <UnsavedChangesGuard dirty={dirty} />
      <FormErrorSummary errors={summary} focusKey={failedSubmits} />
      {change.failure ? (
        change.failure.code === "settings_changed" ? (
          <Notice
            tone="warning"
            alert
            title="These settings changed"
            actions={
              <StaffButton size="sm" variant="secondary" onClick={change.reload}>
                Reload
              </StaffButton>
            }
          >
            Someone else saved these settings while you had them open. Reload to see their changes.
            Nothing you typed has been saved.
          </Notice>
        ) : (
          <Notice tone="danger" alert title="The settings weren't saved">
            {change.failure.message}
          </Notice>
        )
      ) : null}

      <FormSection
        title="Online booking"
        description="Clients can book a collection from their purchases only while this is on."
      >
        <ChoiceRow
          htmlFor={field("enabled")}
          label="Let clients book collections online"
          description={
            draft.onlineBookingEnabled
              ? "On: clients see free times and can book, change and cancel."
              : "Off: clients are asked to contact the gallery to arrange a collection."
          }
          disabled={locked}
          control={
            <StaffSwitch
              id={field("enabled")}
              checked={draft.onlineBookingEnabled}
              disabled={locked}
              onCheckedChange={(next) => set("onlineBookingEnabled", next)}
            />
          }
        />
        <Field
          label="Booking enquiries email"
          description="Shown to clients who need something the booking can't do. Leave empty to use the gallery's general address."
          id={field("booking_email")}
          error={shown.rules.booking_email}
          optional
          disabled={locked}
        >
          <TextInput
            type="email"
            autoComplete="off"
            value={draft.bookingEmail}
            maxLength={254}
            onChange={(event) => set("bookingEmail", event.target.value)}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Weekly hours"
        description="When visits can be booked each week, in London time. Closures and bank holidays are on the Closures tab."
      >
        <HoursEditor
          hours={draft.hours}
          issues={shown.hours}
          disabled={locked}
          onChange={(hours) => set("hours", hours)}
        />
      </FormSection>

      <FormSection
        title="Visits"
        description="How long a visit lasts and how many can happen at once."
      >
        <FieldRow>
          <Field
            label="Visit length"
            id={field("visit_minutes")}
            error={shown.rules.visit_minutes}
            disabled={locked}
          >
            <EnumSelect
              value={draft.visitMinutes}
              options={VISIT_OPTIONS}
              disabled={locked}
              onValueChange={(next) => set("visitMinutes", next)}
            />
          </Field>
          <Field
            label="Visits at the same time"
            description="Each takes one place."
            id={field("places_per_slot")}
            error={shown.rules.places_per_slot}
            disabled={locked}
          >
            <TextInput
              inputMode="numeric"
              value={draft.placesPerSlot}
              maxLength={2}
              onChange={(event) => set("placesPerSlot", event.target.value)}
            />
          </Field>
        </FieldRow>
        <Field
          label="Visits an account can hold"
          description="Booked visits at once, per account, from 1 to 20"
          id={field("max_active_visits")}
          error={shown.rules.max_active_visits}
          disabled={locked}
        >
          <TextInput
            inputMode="numeric"
            className="max-w-40"
            value={draft.maxActiveVisits}
            maxLength={2}
            onChange={(event) => set("maxActiveVisits", event.target.value)}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Notice and window"
        description="The latest a client can book or change a visit, and how far ahead they can book."
      >
        <FieldRow>
          <Field
            label="Cut-off time"
            description="On the working day before the visit"
            id={field("notice_cutoff")}
            error={shown.rules.notice_cutoff}
            disabled={locked}
          >
            <TextInput
              inputMode="numeric"
              placeholder="16:00"
              value={draft.noticeCutoffLocal}
              maxLength={5}
              onChange={(event) => set("noticeCutoffLocal", event.target.value)}
            />
          </Field>
          <Field
            label="Working days' notice"
            id={field("notice_working_days")}
            error={shown.rules.notice_working_days}
            disabled={locked}
          >
            <TextInput
              inputMode="numeric"
              value={draft.noticeWorkingDays}
              maxLength={1}
              onChange={(event) => set("noticeWorkingDays", event.target.value)}
            />
          </Field>
        </FieldRow>
        <Field
          label="Booking window"
          description="Days ahead clients can book, from 7 to 90"
          id={field("window_days")}
          error={shown.rules.window_days}
          disabled={locked}
        >
          <TextInput
            inputMode="numeric"
            className="max-w-40"
            value={draft.windowDays}
            maxLength={2}
            onChange={(event) => set("windowDays", event.target.value)}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Sale days"
        description="Whether a sale at this place closes collections for its days."
      >
        <ChoiceRow
          htmlFor={field("close_on_sale_days")}
          label="Close collections on sale days"
          description="Days of an onsite or hybrid sale at this place. You can open one from the Closures tab."
          disabled={locked}
          control={
            <StaffSwitch
              id={field("close_on_sale_days")}
              checked={draft.closeOnSaleDays}
              disabled={locked}
              onCheckedChange={(next) => set("closeOnSaleDays", next)}
            />
          }
        />
      </FormSection>

      <FormSection
        title="Storage and hand-over"
        description="How long a purchased work is stored for free, and how long a hand-over can be undone."
      >
        <FieldRow>
          <Field
            label="Free storage"
            description="Days after payment clears"
            id={field("free_storage_days")}
            error={shown.rules.free_storage_days}
            optional
            disabled={locked}
          >
            <TextInput
              inputMode="numeric"
              value={draft.freeStorageDays}
              placeholder="30"
              maxLength={3}
              onChange={(event) => set("freeStorageDays", event.target.value)}
            />
          </Field>
          <Field
            label="Storage charge"
            description="Per lot, per week. For Finance only"
            id={field("storage_charge")}
            error={shown.rules.storage_charge}
            optional
            disabled={locked}
          >
            <TextInput
              inputMode="decimal"
              leading={
                <span aria-hidden="true" className="pl-3 text-staff-sm text-staff-muted">
                  £
                </span>
              }
              value={draft.storageChargePounds}
              maxLength={7}
              onChange={(event) => set("storageChargePounds", event.target.value)}
            />
          </Field>
          <Field
            label="Hand-over can be undone for"
            description="Minutes after it is recorded"
            id={field("undo_hand_over_minutes")}
            error={shown.rules.undo_hand_over_minutes}
            disabled={locked}
          >
            <TextInput
              inputMode="numeric"
              value={draft.undoHandOverMinutes}
              maxLength={2}
              onChange={(event) => set("undoHandOverMinutes", event.target.value)}
            />
          </Field>
        </FieldRow>
      </FormSection>

      {canChange ? (
        <FormActions
          sticky
          start={
            dirty ? (
              <StaffButton
                variant="ghost"
                disabled={change.busy}
                onClick={() => {
                  setDraft(draftFromSettings(saved));
                  setAttempted(false);
                  change.clearFailure();
                }}
              >
                Discard changes
              </StaffButton>
            ) : (
              <span className="text-staff-sm text-staff-muted">All changes saved</span>
            )
          }
        >
          <StaffButton type="submit" variant="primary" loading={change.busy} disabled={!dirty}>
            Save changes
          </StaffButton>
        </FormActions>
      ) : null}

      <AffectedBookingsDialog
        open={change.affected !== null}
        where="outside the new hours"
        confirmLabels={{
          keep: "Save and keep them",
          cancel: (count) => `Save and cancel ${count}`,
        }}
        bookings={change.affected ?? []}
        busy={change.busy}
        onConfirm={(choice) => void change.confirm(choice)}
        onCancel={change.dismissAffected}
      />
    </form>
  );
}
