import { getSocket } from "@/lib/socket";

export type SaleroomSocketAdapter = {
  joinSaleroom(saleId: string): void;
  leaveSaleroom(saleId: string): void;
  joinDisplay(saleId: string, displayToken: string): void;
  leaveDisplay(saleId: string): void;
  joinLot(lotId: string): void;
  leaveLot(lotId: string): void;
  onSaleroomEvent(handler: (raw: unknown) => void): void;
  offSaleroomEvent(handler: (raw: unknown) => void): void;
  onDisplayControl(handler: (raw: unknown) => void): void;
  offDisplayControl(handler: (raw: unknown) => void): void;
  onBidUpdate(handler: (raw: unknown) => void): void;
  offBidUpdate(handler: (raw: unknown) => void): void;
  onConnect(handler: () => void): void;
  offConnect(handler: () => void): void;
  onDisconnect(handler: () => void): void;
  offDisconnect(handler: () => void): void;
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
    joinDisplay(saleId: string, displayToken: string) {
      socket.emit("joinDisplay", { saleId, displayToken }, () => {});
    },
    leaveDisplay(saleId: string) {
      socket.emit("leaveDisplay", { saleId }, () => {});
    },
    joinLot(lotId: string) {
      socket.emit("joinLot", { lotId }, () => {});
    },
    leaveLot(lotId: string) {
      socket.emit("leaveLot", { lotId }, () => {});
    },
    onSaleroomEvent(handler) {
      socket.on("saleroomEvent", handler);
    },
    offSaleroomEvent(handler) {
      socket.off("saleroomEvent", handler);
    },
    onDisplayControl(handler) {
      socket.on("displayControl", handler);
    },
    offDisplayControl(handler) {
      socket.off("displayControl", handler);
    },
    onBidUpdate(handler) {
      socket.on("bidUpdate", handler);
    },
    offBidUpdate(handler) {
      socket.off("bidUpdate", handler);
    },
    onConnect(handler) {
      socket.on("connect", handler);
    },
    offConnect(handler) {
      socket.off("connect", handler);
    },
    onDisconnect(handler) {
      socket.on("disconnect", handler);
    },
    offDisconnect(handler) {
      socket.off("disconnect", handler);
    },
    isConnected() {
      return socket.connected;
    },
  };
}

/** Test double — no real socket. */
export function createMockSaleroomSocketAdapter(): SaleroomSocketAdapter & {
  emit(event: unknown): void;
  emitDisplayControl(event: unknown): void;
  emitBidUpdate(event: unknown): void;
  simulateConnect(): void;
  simulateDisconnect(): void;
} {
  let saleroomHandler: ((raw: unknown) => void) | null = null;
  let displayControlHandler: ((raw: unknown) => void) | null = null;
  let bidUpdateHandler: ((raw: unknown) => void) | null = null;
  let connectHandler: (() => void) | null = null;
  let disconnectHandler: (() => void) | null = null;
  let connected = false;

  return {
    joinSaleroom() {},
    leaveSaleroom() {},
    joinDisplay() {},
    leaveDisplay() {},
    joinLot() {},
    leaveLot() {},
    onSaleroomEvent(handler) {
      saleroomHandler = handler;
    },
    offSaleroomEvent() {
      saleroomHandler = null;
    },
    onDisplayControl(handler) {
      displayControlHandler = handler;
    },
    offDisplayControl() {
      displayControlHandler = null;
    },
    onBidUpdate(handler) {
      bidUpdateHandler = handler;
    },
    offBidUpdate() {
      bidUpdateHandler = null;
    },
    onConnect(handler) {
      connectHandler = handler;
    },
    offConnect() {
      connectHandler = null;
    },
    onDisconnect(handler) {
      disconnectHandler = handler;
    },
    offDisconnect() {
      disconnectHandler = null;
    },
    isConnected() {
      return connected;
    },
    emit(event: unknown) {
      saleroomHandler?.(event);
    },
    emitDisplayControl(event: unknown) {
      displayControlHandler?.(event);
    },
    emitBidUpdate(event: unknown) {
      bidUpdateHandler?.(event);
    },
    simulateConnect() {
      connected = true;
      connectHandler?.();
    },
    simulateDisconnect() {
      connected = false;
      disconnectHandler?.();
    },
  };
}
