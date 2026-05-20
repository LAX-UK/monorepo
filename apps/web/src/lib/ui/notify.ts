import { toast } from "sonner";

export type NotifyOpts = {
  description?: string;
  id?: string;
  duration?: number;
};

/** Matches global Toaster default in `@auction/ui` / app wrapper. */
const DEFAULT_SUCCESS_DURATION_MS = 6000;
/** Longer read time for failures (matches prior `admin-cannot-buy` pattern). */
const DEFAULT_ERROR_DURATION_MS = 8000;

export type NotifyPromiseMessages<T> = {
  loading: string;
  success: string | ((value: T) => string);
  error: string | ((error: unknown) => string);
};

/** Imperative toasts — single chokepoint for Sonner.
 * Do not import `sonner` elsewhere in `apps/web` (see `sonner-import.contract.test.ts`).
 * * TODO: optional Sentry breadcrumb on `error` for production diagnostics.
 */
export const notify = {
  success(title: string, opts?: NotifyOpts): string | number {
    return toast.success(title, {
      duration: opts?.duration ?? DEFAULT_SUCCESS_DURATION_MS,
      ...(opts?.description !== undefined ? { description: opts.description } : {}),
      ...(opts?.id !== undefined ? { id: opts.id } : {}),
    });
  },

  /** Realtime / repeatable events must pass `id` for deduplication. */
  info(title: string, opts: NotifyOpts & { id: string }): string | number {
    return toast.info(title, {
      id: opts.id,
      duration: opts.duration ?? DEFAULT_SUCCESS_DURATION_MS,
      ...(opts.description !== undefined ? { description: opts.description } : {}),
    });
  },

  warning(title: string, opts?: NotifyOpts): string | number {
    return toast.warning(title, {
      duration: opts?.duration ?? DEFAULT_SUCCESS_DURATION_MS,
      ...(opts?.description !== undefined ? { description: opts.description } : {}),
      ...(opts?.id !== undefined ? { id: opts.id } : {}),
    });
  },

  error(title: string, opts?: NotifyOpts): string | number {
    return toast.error(title, {
      duration: opts?.duration ?? DEFAULT_ERROR_DURATION_MS,
      ...(opts?.description !== undefined ? { description: opts.description } : {}),
      ...(opts?.id !== undefined ? { id: opts.id } : {}),
    });
  },

  promise<T>(promise: Promise<T>, msgs: NotifyPromiseMessages<T>): Promise<T> {
    void toast.promise(promise, msgs);
    return promise;
  },

  dismiss(toastId?: string | number): void {
    toast.dismiss(toastId);
  },

  /** Long-running staff action — pair with `success`/`error` using the same `id` to resolve. */
  loading(title: string, opts?: NotifyOpts): string | number {
    return toast.loading(title, {
      ...(opts?.description !== undefined ? { description: opts.description } : {}),
      ...(opts?.id !== undefined ? { id: opts.id } : {}),
    });
  },

  /** Soft mutation with optional undo (archive, dismiss, mark read). */
  action(
    title: string,
    opts: NotifyOpts & {
      actionLabel?: string;
      onAction: () => void;
    },
  ): string | number {
    return toast.success(title, {
      duration: opts.duration ?? DEFAULT_SUCCESS_DURATION_MS,
      ...(opts.description !== undefined ? { description: opts.description } : {}),
      ...(opts.id !== undefined ? { id: opts.id } : {}),
      action: {
        label: opts.actionLabel ?? "Undo",
        onClick: opts.onAction,
      },
    });
  },
};
