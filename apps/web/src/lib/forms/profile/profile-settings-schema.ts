import { z } from "zod";

export const profileDisplayNameFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
});

export type ProfileDisplayNameFormValues = z.infer<typeof profileDisplayNameFormSchema>;

export const newAddressFormSchema = z.object({
  label: z.string().min(1).max(80),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200),
  city: z.string().min(1).max(120),
  state: z.string().max(120),
  postalCode: z.string().min(1).max(32),
  country: z.string().min(2).max(120),
  isDefault: z.boolean(),
});

export type NewAddressFormValues = z.infer<typeof newAddressFormSchema>;
