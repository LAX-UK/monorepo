"use client";

import { WorkspacePanel } from "@/components/dashboard/primitives/workspace-panel";
import { COLLECT_COPY } from "@/lib/collect/collect-copy";
import { COLLECT_FIELD_IDS, authorisationText } from "@/lib/collect/collect-form";
import type { CollectAction, CollectState } from "@/lib/collect/collect-state";
import { Checkbox } from "@auction/ui/lax/checkbox";
import { Field, FieldError } from "@auction/ui/lax/field";
import { TextInput } from "@auction/ui/lax/input";
import { cn } from "@auction/ui/lib/utils";
import { RadioGrid, type RadioGridItem } from "./radio-grid";

const COLLECTOR_CHOICES = [
  { id: "self", label: "Me" },
  { id: "third_party", label: COLLECT_COPY.collector.someoneElse },
] as const;

function choiceClass({ checked }: { checked: boolean; disabled: boolean }): string {
  return cn(
    "flex min-h-11 items-center justify-center rounded-lax-control border px-4 text-lax-14 lax-focus",
    "transition-[border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
    checked
      ? "border-lax-ink font-medium shadow-[inset_0_0_0_1px_var(--lax-ink)]"
      : "border-lax-line-strong bg-lax-surface hover:border-lax-control-edge",
  );
}

/** Who collects: the person, or someone they authorise here, named as on their photo ID. */
export function CollectCollectorPanel({
  state,
  myName,
  dispatch,
}: {
  state: CollectState;
  myName: string;
  dispatch: (action: CollectAction) => void;
}) {
  const errorOf = (fieldId: string) => state.errors.find((e) => e.fieldId === fieldId)?.message;
  const nameError = errorOf(COLLECT_FIELD_IDS.name);
  const emailError = errorOf(COLLECT_FIELD_IDS.email);
  const authError = errorOf(COLLECT_FIELD_IDS.authorisation);
  return (
    <WorkspacePanel title={COLLECT_COPY.panels.collector}>
      <div className="flex flex-col gap-4">
        <RadioGrid
          label={COLLECT_COPY.panels.collector}
          items={COLLECTOR_CHOICES.map(
            (choice): RadioGridItem => ({
              id: choice.id,
              label: choice.label,
              className: choiceClass,
              content: choice.label,
            }),
          )}
          value={state.collector === "self" ? "self" : "third_party"}
          onValueChange={(id) =>
            dispatch({
              type: "choose_collector",
              collector: id === "self" ? "self" : "third_party",
            })
          }
          className="grid grid-cols-2 gap-2"
        />
        {state.collector === "self" ? (
          <p className="text-lax-14 text-lax-muted">
            {COLLECT_COPY.collector.self} ({myName})
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field
              id={COLLECT_FIELD_IDS.name}
              label={COLLECT_COPY.collector.name}
              description={COLLECT_COPY.collector.nameHint}
              error={nameError}
            >
              <TextInput
                size="lg"
                autoComplete="off"
                value={state.name}
                onChange={(e) =>
                  dispatch({ type: "set_field", field: "name", value: e.target.value })
                }
              />
            </Field>
            <Field
              id={COLLECT_FIELD_IDS.email}
              label={COLLECT_COPY.collector.email}
              description={COLLECT_COPY.collector.emailHint}
              optional
              error={emailError}
            >
              <TextInput
                size="lg"
                type="email"
                autoComplete="off"
                value={state.email}
                onChange={(e) =>
                  dispatch({ type: "set_field", field: "email", value: e.target.value })
                }
              />
            </Field>
            <Field label={COLLECT_COPY.collector.company} optional>
              <TextInput
                size="lg"
                autoComplete="off"
                value={state.company}
                onChange={(e) =>
                  dispatch({ type: "set_field", field: "company", value: e.target.value })
                }
              />
            </Field>
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={COLLECT_FIELD_IDS.authorisation}
                  checked={state.authorised}
                  onCheckedChange={(on) =>
                    dispatch({ type: "set_authorised", authorised: on === true })
                  }
                  aria-invalid={authError ? true : undefined}
                  aria-describedby={
                    authError ? `${COLLECT_FIELD_IDS.authorisation}-error` : undefined
                  }
                  className="mt-0.5"
                />
                <label
                  htmlFor={COLLECT_FIELD_IDS.authorisation}
                  className="text-lax-14 text-lax-fg"
                >
                  {authorisationText(state.name)}
                </label>
              </div>
              {authError ? (
                <FieldError id={`${COLLECT_FIELD_IDS.authorisation}-error`}>{authError}</FieldError>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </WorkspacePanel>
  );
}
