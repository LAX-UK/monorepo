"use client";

import { UserPicker } from "@/components/admin/user-picker";
import { LabelCaps } from "@/components/ui/typography";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import type { ArtistFormSectionProps } from "../types";

type Props = ArtistFormSectionProps & {
  /** Extra guidance for maker–seller path */
  emphasize?: boolean;
};

export function UserLinkSection({ control, disabled = false, emphasize = false }: Props) {
  return (
    <FormField
      control={control}
      name="ownerUserId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <LabelCaps>Linked platform user</LabelCaps>
          </FormLabel>
          <FormControl>
            <UserPicker
              value={field.value ?? null}
              onChange={(id) => field.onChange(id)}
              disabled={disabled}
            />
          </FormControl>
          <p
            className={`text-xs text-on-surface-variant ${emphasize ? "rounded-lg border border-primary/20 bg-primary-container/10 p-3" : ""}`}
          >
            {emphasize ? (
              <>
                <span className="font-semibold text-on-surface">Required for maker–seller.</span>{" "}
                Search by name or email. Use this when the seller is also the maker of the work. It
                does <span className="font-semibold text-on-surface">not</span> grant the client
                edit access to this catalogue profile—admins remain the sole writers.
              </>
            ) : (
              <>
                Optional link to a platform user. Records attribution only; it does not grant the
                client edit access—admins keep editorial control.
              </>
            )}
          </p>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
