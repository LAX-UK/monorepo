import type { ReactNode } from "react";

export type QuickActionItem = {
  id: string;
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  disabled?: boolean;
  icon?: ReactNode;
};
