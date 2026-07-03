/** Profile settings DTOs — pages and readers import from here, not from UI components. */
export type ProfileAddressRow = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  addressType: "shipping" | "billing" | "both";
  isDefault: boolean;
};
