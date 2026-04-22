/**
 * Re-exports from @auction/validators (SSOT). Local names preserved for existing imports.
 */
import { createAddressBodySchema } from "@auction/validators";
import { updateProfileNameFormSchema } from "@auction/validators";
import { z } from "zod";

export { updateProfileNameFormSchema as profileDisplayNameFormSchema };
export type ProfileDisplayNameFormValues = z.infer<typeof updateProfileNameFormSchema>;

export const newAddressFormSchema = createAddressBodySchema.extend({
  isDefault: z.boolean(),
});
export type NewAddressFormValues = z.infer<typeof newAddressFormSchema>;
