import { uiPreferencePatchSchema } from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type UiPreferencePatch = z.infer<typeof uiPreferencePatchSchema>;

export interface IUiPrefsService {
  patch(prefs: UiPreferencePatch): Promise<ServiceResult<Record<string, unknown>>>;
}
