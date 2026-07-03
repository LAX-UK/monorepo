export type TelephoneBookingUserPhoneRow = {
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  mobile: string | null;
};

export interface ITelephoneBookingUserPhoneReader {
  findByUserId(userId: string): Promise<TelephoneBookingUserPhoneRow | null>;
}
