import type { UiPreferencePatch } from "@auction/validators";
import type { ServiceResult } from "../http/service-result";

export interface IUiPrefsService {
  patch(prefs: UiPreferencePatch): Promise<ServiceResult<Record<string, unknown>>>;
}
