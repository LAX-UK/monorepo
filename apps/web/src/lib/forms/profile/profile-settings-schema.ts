/** Re-exports from @auction/validators (SSOT). Local names preserved for existing imports.
 */
import {
  createAddressBodySchema,
  emptyProfilePhoneFormValues,
  profilePhoneFormSchema,
  splitE164ForForm,
  updateProfileNameFormSchema,
} from "@auction/validators";
import { z } from "zod";

export { updateProfileNameFormSchema as profileDisplayNameFormSchema };
export type ProfileDisplayNameFormValues = z.infer<typeof updateProfileNameFormSchema>;

export { profilePhoneFormSchema, emptyProfilePhoneFormValues, splitE164ForForm };
export type ProfilePhoneFormValues = z.infer<typeof profilePhoneFormSchema>;

export const newAddressFormSchema = createAddressBodySchema.extend({
  isDefault: z.boolean(),
});
export type NewAddressFormValues = z.infer<typeof newAddressFormSchema>;
