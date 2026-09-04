import "socket.io";

declare module "socket.io" {
  interface SocketData {
    userId?: string;
    isAdmin?: boolean;
    ticketUser?: { id: string; role: string; staff_role?: string };
  }
}
