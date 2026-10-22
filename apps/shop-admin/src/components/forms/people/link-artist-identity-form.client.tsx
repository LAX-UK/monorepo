"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  requiredText,
} from "@/lib/form-validation";
import { linkArtistIdentity } from "@/server/application/admin-people-actions.server";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { TextField } from "../fields";

export function LinkArtistIdentityForm({ artistId }: { artistId: string }) {
  const mutation = useAdminMutation();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <AdminForm
      title="Link login by email"
      mutation={mutation}
      errors={errors}
      submitLabel="Link identity"
      onSubmit={() => {
        const next = collectFieldErrors({ email: requiredText(email, "Enter the email address.") });
        setErrors(next);
        if (hasFieldErrors(next)) return;
        void mutation.run(
          () =>
            linkArtistIdentity({
              artistId,
              email: email.trim(),
              idempotencyKey: mutation.idempotencyKey,
            }),
          "Identity linked",
        );
      }}
    >
      <TextField
        name="email"
        label="Email"
        type="email"
        value={email}
        error={errors.email}
        disabled={mutation.pending}
        onChange={setEmail}
      />
    </AdminForm>
  );
}
