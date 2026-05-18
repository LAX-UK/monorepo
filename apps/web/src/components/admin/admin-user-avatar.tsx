"use client";

import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { cn } from "@auction/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@auction/ui/components/avatar";

const TONE_CLASSES = [
  "bg-primary-container text-on-primary-container",
  "bg-secondary-container text-on-secondary-container",
  "bg-tertiary-container text-on-tertiary-container",
  "bg-surface-container-high text-on-surface",
] as const;

function hashUserId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

type AvatarUser = Pick<AdminUserRow, "id" | "name" | "image">;

type Props = {
  user: AvatarUser;
  size?: "sm" | "default" | "lg";
  className?: string;
};

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  sm: "size-8",
  default: "size-10",
  lg: "size-14",
};

export function AdminUserAvatar({ user, size = "default", className }: Props) {
  const tone = TONE_CLASSES[hashUserId(user.id) % TONE_CLASSES.length]!;
  const initials = initialsFromName(user.name);
  const radixSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "default";

  return (
    <Avatar size={radixSize} className={cn(SIZE_CLASS[size], className)}>
      {user.image ? <AvatarImage src={user.image} alt="" /> : null}
      <AvatarFallback className={cn("font-label text-xs font-semibold", tone)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
