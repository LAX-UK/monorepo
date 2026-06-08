/** Normalized postal address used for Stripe Connect account prefill. */
export type ConnectAddressSnapshot = {
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
};
