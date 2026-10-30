"use client";

import { Field, ReadOnlyView, Switch, TextArea, TextInput } from "@auction/ui/lax";
import { Search } from "lucide-react";
import { useId } from "react";
import { FORCED, SheetSection, StateRow } from "./sheet-frame";

function SwitchWithLabel({
  label,
  checked,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <span className="inline-flex items-center gap-2">
      <Switch id={id} defaultChecked={checked} disabled={disabled} />
      <label htmlFor={id} className="text-lax-ui text-lax-fg">
        {label}
      </label>
    </span>
  );
}

export function SheetFields() {
  return (
    <SheetSection
      id="fields"
      title="Form fields and switches"
      description="Label above at 500, a hint under it and the error under the field. Fields are 36px and 44px on a client's phone; the edge keeps 3:1 on every surface. A read-only value is plain text, never a greyed-out field. Switch: 32×20 for staff, 40×24 for clients."
    >
      {() => (
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <Field label="Email">
            <TextInput placeholder="name@gallery.com" />
          </Field>
          <Field label="Focus">
            <TextInput defaultValue="lena@studio-lf.de" boxClassName={FORCED.focus} />
          </Field>
          <Field label="Email" error="Enter an email like name@gallery.com">
            <TextInput defaultValue="lena@studio" />
          </Field>
          <Field label="Organisation" disabled>
            <TextInput defaultValue="Northbank Gallery" />
          </Field>
          <Field label="Website" optional description="Shown to buyers on your works.">
            <TextInput placeholder="northbank.gallery" />
          </Field>
          <Field label="Search">
            <TextInput
              type="search"
              placeholder="Search by title or artist"
              leading={<Search aria-hidden />}
            />
          </Field>
          <ReadOnlyView>
            <Field label="Read only">
              <TextInput defaultValue="Northbank Gallery Ltd" />
            </Field>
          </ReadOnlyView>
          <Field label="Note" optional>
            <TextArea placeholder="Anything the specialist should know" />
          </Field>
          <div className="md:col-span-2">
            <StateRow label="Switch">
              <SwitchWithLabel label="On" checked />
              <SwitchWithLabel label="Off" checked={false} />
              <SwitchWithLabel label="Disabled on" checked disabled />
              <SwitchWithLabel label="Disabled off" checked={false} disabled />
            </StateRow>
          </div>
        </div>
      )}
    </SheetSection>
  );
}
