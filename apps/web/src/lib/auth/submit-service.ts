import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";

/** Narrow contract for `useAuthSubmit` (DIP). */
export type SubmitService<TData> = (data: TData) => Promise<AuthSubmitResult>;
