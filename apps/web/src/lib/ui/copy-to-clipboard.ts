import { notify } from "@/lib/ui/notify";

/** Copies text and says so; a refusal by the browser is said too, never silent. */
export function copyToClipboard(value: string, noun: string): void {
  void navigator.clipboard
    ?.writeText(value)
    .then(() => notify.success(`${noun} copied`))
    .catch(() => notify.error(`Could not copy the ${noun.toLowerCase()}`));
}
