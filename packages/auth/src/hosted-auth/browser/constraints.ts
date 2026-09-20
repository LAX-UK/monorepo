import { HOSTED_AUTH_POLICY } from "../policy.js";
import { HOSTED_AUTH_MESSAGES as msg } from "./messages.js";

export const HOSTED_FIELD_KINDS = [
  "email",
  "password",
  "new-password",
  "otp",
  "phone",
  "name",
  "text",
] as const;

export type HostedFieldKind = (typeof HOSTED_FIELD_KINDS)[number];

export function parseFieldKind(value: string | null | undefined): HostedFieldKind {
  if (value && (HOSTED_FIELD_KINDS as readonly string[]).includes(value)) {
    return value as HostedFieldKind;
  }
  return "text";
}

export type ValidityFlags = {
  valueMissing: boolean;
  typeMismatch: boolean;
  patternMismatch: boolean;
  tooShort: boolean;
  tooLong: boolean;
};

const REQUIRED_MESSAGE: Record<HostedFieldKind, string> = {
  email: msg.EMAIL_REQUIRED,
  password: msg.PASSWORD_REQUIRED,
  "new-password": msg.PASSWORD_REQUIRED,
  otp: msg.OTP_REQUIRED,
  phone: msg.PHONE_REQUIRED,
  name: msg.NAME_REQUIRED,
  text: msg.REQUIRED,
};

export function messageForValidityState(
  kind: HostedFieldKind,
  validity: ValidityFlags,
  input: { minLength: number; maxLength: number; validationMessage: string },
): string {
  if (validity.valueMissing) return REQUIRED_MESSAGE[kind];
  if (validity.typeMismatch && kind === "email") return msg.EMAIL_INVALID;
  if ((validity.patternMismatch || validity.tooShort) && kind === "otp") return msg.OTP_INVALID;
  if (validity.tooShort && (kind === "password" || kind === "new-password")) {
    return `Password must be at least ${input.minLength} characters.`;
  }
  if (validity.tooLong && (kind === "password" || kind === "new-password")) {
    return `Password must be at most ${input.maxLength} characters.`;
  }
  return input.validationMessage || msg.REQUIRED;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailConstraintMessage(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return msg.EMAIL_REQUIRED;
  if (!EMAIL_PATTERN.test(trimmed)) return msg.EMAIL_INVALID;
  return null;
}

export function requiredPasswordMessage(value: string): string | null {
  if (!value) return msg.PASSWORD_REQUIRED;
  return null;
}

export function newPasswordConstraintMessage(
  value: string,
  minLength = HOSTED_AUTH_POLICY.passwordMinLength,
  maxLength = HOSTED_AUTH_POLICY.passwordMaxLength,
): string | null {
  if (!value) return msg.PASSWORD_REQUIRED;
  if (value.length < minLength) {
    return `Password must be at least ${minLength} characters.`;
  }
  if (value.length > maxLength) {
    return `Password must be at most ${maxLength} characters.`;
  }
  return null;
}

export function otpConstraintMessage(
  value: string,
  length = HOSTED_AUTH_POLICY.otpLength,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return msg.OTP_REQUIRED;
  if (!/^\d+$/.test(trimmed) || trimmed.length !== length) {
    return length === 6 ? msg.OTP_INVALID : `Enter the ${length}-digit code.`;
  }
  return null;
}

export function requiredNameMessage(value: string): string | null {
  if (!value.trim()) return msg.NAME_REQUIRED;
  return null;
}

export function requiredPhoneMessage(value: string): string | null {
  if (!value.trim()) return msg.PHONE_REQUIRED;
  return null;
}
