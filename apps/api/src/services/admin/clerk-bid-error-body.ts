import { type StaffBidLimitRefusal, staffBidLimitRefusalFrom } from "@auction/domain";

export type ClerkBidErrorBody = {
  error: string;
  code?: string;
  /** Present when a limit refused the bid: which limit and how much it allows. */
  refusal?: StaffBidLimitRefusal;
};

/**
 * The clerk console's answer to a refused paddle or telephone bid. A limit refusal carries the
 * limit, so the console can say which one stopped the bid, how much it allows and what to do.
 */
export function clerkBidErrorBody(error: {
  message: string;
  code?: string | undefined;
  details?: Readonly<Record<string, string>> | undefined;
}): ClerkBidErrorBody {
  const refusal = staffBidLimitRefusalFrom(error.code, error.details);
  return {
    error: error.message,
    ...(error.code ? { code: error.code } : {}),
    ...(refusal ? { refusal } : {}),
  };
}
