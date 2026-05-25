import { isOrgModuleEnabled, orgModuleDisabledResponse } from "./org-module-enabled.js";

export type OrgModuleGate = {
  isEnabled: () => boolean;
  disabledResponse: () => ReturnType<typeof orgModuleDisabledResponse>;
};

export function createOrgModuleGate(webOrigin: string): OrgModuleGate {
  return {
    isEnabled: () => isOrgModuleEnabled(webOrigin),
    disabledResponse: orgModuleDisabledResponse,
  };
}
