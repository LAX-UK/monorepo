export type HotkeyScope = "global" | "page" | "table" | "dialog";

export type HotkeyBinding = {
  id: string;
  keys: string;
  label: string;
  description?: string;
  scope: HotkeyScope;
  group: string;
  handler: (event: KeyboardEvent) => void;
  when?: () => boolean;
};

type Listener = () => void;

const bindings = new Map<string, HotkeyBinding>();
const scopeStack: HotkeyScope[] = ["global"];
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeHotkeys(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActiveHotkeyScope(): HotkeyScope {
  return scopeStack[scopeStack.length - 1] ?? "global";
}

export function pushHotkeyScope(scope: HotkeyScope): void {
  scopeStack.push(scope);
  notify();
}

export function popHotkeyScope(scope?: HotkeyScope): void {
  if (scopeStack.length <= 1) return;
  if (scope) {
    const idx = scopeStack.lastIndexOf(scope);
    if (idx > 0) scopeStack.splice(idx, 1);
  } else {
    scopeStack.pop();
  }
  notify();
}

export function registerHotkey(binding: HotkeyBinding): () => void {
  if (bindings.has(binding.id)) {
    bindings.delete(binding.id);
  }
  const conflict = [...bindings.values()].find(
    (b) => b.id !== binding.id && b.keys === binding.keys && b.scope === binding.scope,
  );
  if (conflict) {
    console.warn(`Hotkey conflict: ${binding.keys} already bound in scope ${binding.scope}`);
  }
  bindings.set(binding.id, binding);
  notify();
  return () => {
    bindings.delete(binding.id);
    notify();
  };
}

export function listHotkeysForScope(scope?: HotkeyScope): HotkeyBinding[] {
  const active = scope ?? getActiveHotkeyScope();
  const allowed =
    active === "global"
      ? new Set<HotkeyScope>(["global"])
      : active === "page"
        ? new Set<HotkeyScope>(["global", "page"])
        : active === "table"
          ? new Set<HotkeyScope>(["global", "page", "table"])
          : new Set<HotkeyScope>(["global", "page", "table", "dialog"]);

  return [...bindings.values()]
    .filter((b) => allowed.has(b.scope))
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
}

export function getGroupedHotkeys(scope?: HotkeyScope): Map<string, HotkeyBinding[]> {
  const grouped = new Map<string, HotkeyBinding[]>();
  for (const binding of listHotkeysForScope(scope)) {
    const list = grouped.get(binding.group) ?? [];
    list.push(binding);
    grouped.set(binding.group, list);
  }
  return grouped;
}

export function resetHotkeyRegistryForTests(): void {
  bindings.clear();
  scopeStack.length = 0;
  scopeStack.push("global");
  listeners.clear();
}
