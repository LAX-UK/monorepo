import type { RequestEmailChangeInput } from "@auction/validators";
import type { IdentityHttpJson } from "./identity-route-http.js";

export interface IIdentityAccountSecurityHttpApplicationService {
  reauth(input: {
    userId: string | undefined;
    password: string;
    sessionTokenFromCookie: string | null | undefined;
  }): Promise<IdentityHttpJson>;

  changePassword(input: {
    userId: string | undefined;
    currentPassword: string;
    newPassword: string;
    sessionToken: string | null | undefined;
  }): Promise<IdentityHttpJson>;

  forgotPassword(input: {
    email: string;
    webOrigin: string;
    clientIp?: string;
  }): Promise<IdentityHttpJson>;

  setupPassword(input: {
    userId: string | undefined;
    password: string;
    sessionTokenFromCookie: string | null | undefined;
  }): Promise<IdentityHttpJson>;

  requestEmailChange(input: {
    userId: string | undefined;
    body: RequestEmailChangeInput;
  }): Promise<IdentityHttpJson>;

  clearEmailChange(input: {
    userId: string | undefined;
  }): Promise<IdentityHttpJson>;

  confirmEmailChange(input: {
    token: string;
  }): Promise<IdentityHttpJson>;

  getPasswordStatus(input: { userId: string | undefined }): Promise<IdentityHttpJson>;
}
