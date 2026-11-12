import type { toast as SonnerToast } from "sonner";

/**
 * The toast library and its on-screen host are fetched when the first toast is raised, not with
 * the page. `runToast` asks for the host to mount (see `ToasterGate`), loads the library, and
 * runs the action once a host is on screen, so a toast raised before either is ready is shown
 * (in order) rather than lost.
 */
export type ToastApi = typeof SonnerToast;
type ToastAction = (toast: ToastApi) => void;

let toastApi: ToastApi | null = null;
let loading: Promise<void> | null = null;
let requested = false;
let hosts = 0;
let queue: ToastAction[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function flush(): void {
  if (!toastApi || hosts === 0) return;
  const api = toastApi;
  const due = queue;
  queue = [];
  for (const action of due) action(api);
}

function load(): void {
  if (loading) return;
  loading = import("sonner").then((mod) => {
    toastApi = mod.toast;
    flush();
  });
}

/** Raises a toast through the library, loading it and its host first when needed. */
export function runToast(action: ToastAction): void {
  queue.push(action);
  if (!requested) {
    requested = true;
    emit();
  }
  load();
  flush();
}

/** Like `runToast`, for actions that mean nothing until a toast exists (dismissing one). */
export function runToastIfRaised(action: ToastAction): void {
  if (requested) runToast(action);
}

/** A toaster calls this while it is on screen, so queued toasts know where to appear. */
export function registerToaster(): () => void {
  hosts += 1;
  flush();
  return () => {
    hosts -= 1;
  };
}

/** Whether a toast has been asked for; the gate mounts the host from then on. */
export function subscribeToastRequested(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toastRequested(): boolean {
  return requested;
}

/** Test seam: forget everything, as a fresh page load would. */
export function resetToastBridge(): void {
  toastApi = null;
  loading = null;
  requested = false;
  hosts = 0;
  queue = [];
  listeners.clear();
}
