export type AuthSubmitResult =
  | { ok: true; code?: string }
  | { ok: false; message: string; code?: string };
