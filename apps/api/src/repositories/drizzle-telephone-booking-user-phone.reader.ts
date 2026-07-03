import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  ITelephoneBookingUserPhoneReader,
  TelephoneBookingUserPhoneRow,
} from "./interfaces/telephone-booking-user-phone.reader.js";

export class DrizzleTelephoneBookingUserPhoneReader implements ITelephoneBookingUserPhoneReader {
  constructor(private readonly db: Database) {}

  async findByUserId(userId: string): Promise<TelephoneBookingUserPhoneRow | null> {
    const [row] = await this.db
      .select({
        phoneNumber: user.phoneNumber,
        phoneNumberVerified: user.phoneNumberVerified,
        mobile: user.mobile,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row ?? null;
  }
}
