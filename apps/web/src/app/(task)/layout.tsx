import { TaskRouteHeader } from "@/components/task/task-route-header";
import type { ReactNode } from "react";

/** Minimal chrome for focused tasks (auth, onboarding) — no marketing mega nav or footer. */
export default function TaskLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <TaskRouteHeader />
      {children}
    </>
  );
}
