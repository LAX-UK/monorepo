import { runToast, runToastIfRaised } from "@/lib/ui/toast-bridge";

export type NotifyAction = {
  label: string;
  onClick: () => void;
};

export type NotifyOpts = {
  description?: string;
  id?: string;
  duration?: number;
  action?: NotifyAction;
  cancel?: NotifyAction;
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

/** Imperative toasts — single chokepoint for Sonner, loaded when the first toast is raised
 * (`toast-bridge.ts`), so none of them returns an id.
 * Do not import `sonner` elsewhere in `apps/web` (see `sonner-import.contract.test.ts`).
 * `error` also leaves a Sentry breadcrumb carrying the notice `id` only (never its text); the
 * Sentry wrapper is fetched lazily so public routes carry no extra JS.
 */
export const notify = {
  success(title: string, opts?: NotifyOpts): void {
    runToast((toast) => {
      toast.success(title, {
        duration: opts?.duration ?? DEFAULT_SUCCESS_DURATION_MS,
        ...(opts?.description !== undefined ? { description: opts.description } : {}),
        ...(opts?.id !== undefined ? { id: opts.id } : {}),
      });
    });
  },

  /** Realtime / repeatable events must pass `id` for deduplication. */
  info(title: string, opts: NotifyOpts & { id: string }): void {
    runToast((toast) => {
      toast.info(title, {
        id: opts.id,
        duration: opts.duration ?? DEFAULT_SUCCESS_DURATION_MS,
        ...(opts.description !== undefined ? { description: opts.description } : {}),
      });
    });
  },

  warning(title: string, opts?: NotifyOpts): void {
    runToast((toast) => {
      toast.warning(title, {
        duration: opts?.duration ?? DEFAULT_SUCCESS_DURATION_MS,
        ...(opts?.description !== undefined ? { description: opts.description } : {}),
        ...(opts?.id !== undefined ? { id: opts.id } : {}),
      });
    });
  },

  error(title: string, opts?: NotifyOpts): void {
    void import("@/lib/observability/notice-breadcrumb")
      .then((mod) => mod.addErrorNoticeBreadcrumb(opts?.id))
      .catch(() => undefined);
    runToast((toast) => {
      toast.error(title, {
        duration: opts?.duration ?? DEFAULT_ERROR_DURATION_MS,
        ...(opts?.description !== undefined ? { description: opts.description } : {}),
        ...(opts?.id !== undefined ? { id: opts.id } : {}),
        ...(opts?.action !== undefined ? { action: opts.action } : {}),
        ...(opts?.cancel !== undefined ? { cancel: opts.cancel } : {}),
      });
    });
  },

  promise<T>(promise: Promise<T>, msgs: NotifyPromiseMessages<T>): Promise<T> {
    runToast((toast) => {
      void toast.promise(promise, msgs);
    });
    return promise;
  },

  dismiss(toastId?: string | number): void {
    runToastIfRaised((toast) => {
      toast.dismiss(toastId);
    });
  },

  /** Long-running staff action — pair with `success`/`error` using the same `id` to resolve. */
  loading(title: string, opts?: NotifyOpts): void {
    runToast((toast) => {
      toast.loading(title, {
        ...(opts?.description !== undefined ? { description: opts.description } : {}),
        ...(opts?.id !== undefined ? { id: opts.id } : {}),
      });
    });
  },

  /** Soft mutation with optional undo (archive, dismiss, mark read). */
  action(
    title: string,
    opts: NotifyOpts & {
      actionLabel?: string;
      onAction: () => void;
    },
  ): void {
    runToast((toast) => {
      toast.success(title, {
        duration: opts.duration ?? DEFAULT_SUCCESS_DURATION_MS,
        ...(opts.description !== undefined ? { description: opts.description } : {}),
        ...(opts.id !== undefined ? { id: opts.id } : {}),
        action: {
          label: opts.actionLabel ?? "Undo",
          onClick: opts.onAction,
        },
      });
    });
  },
};
