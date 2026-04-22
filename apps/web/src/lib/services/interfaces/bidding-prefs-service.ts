import type { biddingPreferencesPatchSchema } from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type BiddingPreferencesPatch = z.infer<typeof biddingPreferencesPatchSchema>;

export interface IBiddingPrefsService {
  patch(prefs: BiddingPreferencesPatch): Promise<ServiceResult<Record<string, unknown>>>;
}
