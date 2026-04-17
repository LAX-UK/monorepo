"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

type TabsCtx = {
  value: string;
  setValue: (v: string) => void;
};

const Ctx = createContext<TabsCtx | null>(null);

function useTabsCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("Tabs compound components must be used within <Tabs>");
  return v;
}

export function Tabs({
  defaultValue,
  children,
  className = "",
}: {
  defaultValue: string;
  children: ReactNode;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const memo = useMemo(() => ({ value, setValue }), [value]);
  return (
    <Ctx.Provider value={memo}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  );
}

Tabs.List = function TabsList({
  children,
  className = "",
}: { children: ReactNode; className?: string }) {
  return (
    <div role="tablist" className={`flex flex-wrap gap-2 ${className}`}>
      {children}
    </div>
  );
};

Tabs.Trigger = function TabsTrigger({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: active, setValue } = useTabsCtx();
  const selected = active === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={`rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest transition-colors ${
        selected
          ? "bg-primary text-on-primary"
          : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
      } ${className}`}
      onClick={() => setValue(value)}
    >
      {children}
    </button>
  );
};

Tabs.Content = function TabsContent({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: active } = useTabsCtx();
  if (active !== value) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
};
