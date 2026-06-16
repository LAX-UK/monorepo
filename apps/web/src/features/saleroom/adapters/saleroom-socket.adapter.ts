import { getSocket } from "@/lib/socket";

export type SaleroomSocketAdapter = {
  joinSaleroom(saleId: string): void;
  leaveSaleroom(saleId: string): void;
  onSaleroomEvent(handler: (raw: unknown) => void): void;
  offSaleroomEvent(handler: (raw: unknown) => void): void;
  onConnect(handler: () => void): void;
  offConnect(handler: () => void): void;
  isConnected(): boolean;
};

export function createSaleroomSocketAdapter(): SaleroomSocketAdapter {
  const socket = getSocket();
  return {
    joinSaleroom(saleId: string) {
      socket.emit("joinSaleroom", { saleId }, () => {});
    },
    leaveSaleroom(saleId: string) {
      socket.emit("leaveSaleroom", { saleId }, () => {});
    },
    onSaleroomEvent(handler) {
      socket.on("saleroomEvent", handler);
    },
    offSaleroomEvent(handler) {
      socket.off("saleroomEvent", handler);
    },
    onConnect(handler) {
      socket.on("connect", handler);
    },
    offConnect(handler) {
      socket.off("connect", handler);
    },
    isConnected() {
      return socket.connected;
    },
  };
}

/** Test double — no real socket. */
export function createMockSaleroomSocketAdapter(): SaleroomSocketAdapter & {
  emit(event: unknown): void;
  simulateConnect(): void;
} {
  let saleroomHandler: ((raw: unknown) => void) | null = null;
  let connectHandler: (() => void) | null = null;
  let connected = false;

  return {
    joinSaleroom() {},
    leaveSaleroom() {},
    onSaleroomEvent(handler) {
      saleroomHandler = handler;
    },
    offSaleroomEvent() {
      saleroomHandler = null;
    },
    onConnect(handler) {
      connectHandler = handler;
    },
    offConnect() {
      connectHandler = null;
    },
    isConnected() {
      return connected;
    },
    emit(event: unknown) {
      saleroomHandler?.(event);
    },
    simulateConnect() {
      connected = true;
      connectHandler?.();
    },
  };
}
