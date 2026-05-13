"use client";

import { parseUserNotification } from "@/lib/data/http/parse";
import { getSocket } from "@/lib/socket";
import type { UserNotification } from "@auction/types";
import { useEffect, useRef } from "react";

export type UserNotificationSocketPayload = {
  type?: string;
  notification?: unknown;
};

/** Joins the authenticated user's Socket.IO room and forwards inbox payloads from Redis.
 */
export function useUserNotifications(opts: {
  enabled: boolean;
  onNotification?: (n: UserNotification) => void;
}) {
  const cbRef = useRef(opts.onNotification);
  cbRef.current = opts.onNotification;

  useEffect(() => {
    if (!opts.enabled) return;
    const socket = getSocket();
    const onPayload = (raw: unknown) => {
      const o = raw as UserNotificationSocketPayload;
      if (o?.type !== "notification_created" || o.notification == null) return;
      const n = parseUserNotification(o.notification);
      cbRef.current?.(n);
    };
    socket.emit("joinUser", {}, () => {});
    socket.on("userNotification", onPayload);
    return () => {
      socket.off("userNotification", onPayload);
      socket.emit("leaveUser", {}, () => {});
    };
  }, [opts.enabled]);
}
