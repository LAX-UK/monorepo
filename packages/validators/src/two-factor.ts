import { z } from "zod";

/** Six-digit TOTP from an authenticator app (value only; wrap in an object for forms). */
export const totpCodeValueSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app");

export const totpVerifyFormSchema = z.object({
  code: totpCodeValueSchema,
});

export type TotpVerifyFormValues = z.infer<typeof totpVerifyFormSchema>;

/** Backup recovery code (Better Auth default length is 10). */
export const backupCodeValueSchema = z
  .string()
  .trim()
  .min(8, "Enter your backup code")
  .max(32, "That backup code looks too long")
  .regex(/^[A-Za-z0-9_-]+$/, "Backup codes use letters and numbers only");

export const backupCodeFormSchema = z.object({
  code: backupCodeValueSchema,
});

export type BackupCodeFormValues = z.infer<typeof backupCodeFormSchema>;

/** Current password for sensitive 2FA actions. */
export const twoFactorPasswordSchema = z.string().min(8, "Use at least 8 characters");

export const enableTwoFactorFormSchema = z.object({
  password: twoFactorPasswordSchema,
});

export type EnableTwoFactorFormValues = z.infer<typeof enableTwoFactorFormSchema>;

export const disableTwoFactorFormSchema = z.object({
  password: twoFactorPasswordSchema,
});

export type DisableTwoFactorFormValues = z.infer<typeof disableTwoFactorFormSchema>;

export const regenerateBackupCodesFormSchema = z.object({
  password: twoFactorPasswordSchema,
});

export type RegenerateBackupCodesFormValues = z.infer<typeof regenerateBackupCodesFormSchema>;
