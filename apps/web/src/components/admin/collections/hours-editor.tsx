"use client";

import { type HoursRangeDraft, newRangeKey } from "@/lib/admin/collections/collection-forms";
import { HOURS_ISSUE_MESSAGES, WEEKDAYS } from "@/lib/admin/collections/collections.vm";
import type { HoursIssueCode } from "@auction/domain";
import { MAX_RANGES_PER_WEEKDAY } from "@auction/domain";
import { StaffButton, TextInput } from "@auction/staff-ui";
import { Plus, Trash2 } from "@auction/staff-ui/icons";

type Props = {
  hours: readonly HoursRangeDraft[];
  /** What is wrong with a range, by its key. */
  issues: Readonly<Record<string, HoursIssueCode>>;
  disabled: boolean;
  onChange: (hours: HoursRangeDraft[]) => void;
};

/**
 * The week's opening hours, a day to a row: Monday to Sunday, each with its opening times (up to
 * four, for a lunch break) or "Closed". Times are London time. A day with no times is closed.
 */
export function HoursEditor({ hours, issues, disabled, onChange }: Props) {
  const update = (key: string, patch: Partial<HoursRangeDraft>) =>
    onChange(hours.map((range) => (range.key === key ? { ...range, ...patch } : range)));
  const remove = (key: string) => onChange(hours.filter((range) => range.key !== key));
  const add = (weekday: number) => {
    const last = hours.filter((range) => range.weekday === weekday).at(-1);
    const next: HoursRangeDraft = {
      key: newRangeKey(),
      weekday,
      opensLocal: last ? last.closesLocal : "10:00",
      closesLocal: last ? "" : "19:00",
    };
    onChange([...hours, next]);
  };

  return (
    <fieldset className="flex min-w-0 flex-col divide-y divide-staff-line-subtle">
      <legend className="sr-only">Opening hours</legend>
      {WEEKDAYS.map(({ weekday, label }) => {
        const ranges = hours.filter((range) => range.weekday === weekday);
        return (
          <div
            key={weekday}
            className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4"
          >
            <span className="pt-2 text-staff-sm font-medium text-staff-fg">{label}</span>
            <div className="flex min-w-0 flex-col gap-2">
              {ranges.length === 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-staff-sm text-staff-muted">Closed</span>
                  {!disabled ? (
                    <StaffButton
                      size="sm"
                      variant="secondary"
                      icon={<Plus aria-hidden />}
                      onClick={() => add(weekday)}
                    >
                      <span className="sr-only">Add opening time on {label}</span>
                      <span aria-hidden>Add hours</span>
                    </StaffButton>
                  ) : null}
                </div>
              ) : (
                ranges.map((range, index) => {
                  const issue = issues[range.key];
                  const id = `${range.key}-error`;
                  return (
                    <div key={range.key} className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <TextInput
                          id={`${range.key}-opens`}
                          aria-label={`${label} opens`}
                          aria-describedby={issue ? id : undefined}
                          inputMode="numeric"
                          placeholder="10:00"
                          className="w-24"
                          value={range.opensLocal}
                          maxLength={5}
                          disabled={disabled}
                          invalid={issue !== undefined}
                          onChange={(event) =>
                            update(range.key, { opensLocal: event.target.value })
                          }
                        />
                        <span aria-hidden className="text-staff-muted">
                          to
                        </span>
                        <TextInput
                          aria-label={`${label} closes`}
                          aria-describedby={issue ? id : undefined}
                          inputMode="numeric"
                          placeholder="19:00"
                          className="w-24"
                          value={range.closesLocal}
                          maxLength={5}
                          disabled={disabled}
                          invalid={issue !== undefined}
                          onChange={(event) =>
                            update(range.key, { closesLocal: event.target.value })
                          }
                        />
                        {!disabled ? (
                          <>
                            <StaffButton
                              size="icon-sm"
                              variant="ghost"
                              icon={<Trash2 aria-hidden />}
                              aria-label={`Remove ${label} opening time ${index + 1}`}
                              onClick={() => remove(range.key)}
                            />
                            {index === ranges.length - 1 &&
                            ranges.length < MAX_RANGES_PER_WEEKDAY ? (
                              <StaffButton
                                size="icon-sm"
                                variant="ghost"
                                icon={<Plus aria-hidden />}
                                aria-label={`Add another opening time on ${label}`}
                                onClick={() => add(weekday)}
                              />
                            ) : null}
                          </>
                        ) : null}
                      </div>
                      {issue ? (
                        <p id={id} className="text-staff-xs text-staff-danger-fg">
                          {HOURS_ISSUE_MESSAGES[issue]}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
