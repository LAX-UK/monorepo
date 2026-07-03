"use client";

import {
  type IResetPasswordService,
  ResetPasswordService,
} from "@/lib/auth/services/reset-password.service";

export type AuthClientServices = {
  resetPassword: IResetPasswordService;
};

let cached: AuthClientServices | null = null;

/** Client composition root for auth flows (DIP). */
export function getAuthClientServices(): AuthClientServices {
  if (!cached) {
    cached = { resetPassword: new ResetPasswordService() };
  }
  return cached;
}

export function __resetAuthClientServicesForTests(): void {
  cached = null;
}
