export type TelephoneBookingUserPhoneRow = {
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
};

export interface ITelephoneBookingUserPhoneReader {
  findByUserId(userId: string): Promise<TelephoneBookingUserPhoneRow | null>;
}
