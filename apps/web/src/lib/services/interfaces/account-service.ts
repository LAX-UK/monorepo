import type { RequestEmailChangeInput } from "@auction/validators";
import type { ServiceResult } from "../http/service-result";

export interface IAccountService {
  requestEmailChange(
    input: RequestEmailChangeInput,
  ): Promise<ServiceResult<Record<string, unknown>>>;
  confirmEmailChange(input: { token: string }): Promise<ServiceResult<Record<string, unknown>>>;
}
