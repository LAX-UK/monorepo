import type { Socket } from "socket.io-client";

/** Room events: 1 for a join, 0 for the leave that undoes it. */
const ROOM_EVENTS: Record<string, 0 | 1> = {
  joinUser: 1,
  leaveUser: 0,
  joinSaleroom: 1,
  leaveSaleroom: 0,
};

type Room = {
  event: string;
  // biome-ignore lint/suspicious/noExplicitAny: emit arguments and acks are the page's and the server's.
  args: any[];
  /** Whether it has gone out on this connection. */
  sent: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: same as above.
  acks: Array<(...reply: any[]) => void>;
  /** The server's answer on this connection, once it has come. */
  // biome-ignore lint/suspicious/noExplicitAny: same as above.
  reply?: any[] | undefined;
};

/**
 * Makes the socket keep the rooms the page joins, so a join is sent once on every `connect` (the
 * first and after each reconnect) and never twice for one connection, however many times a page
 * asks for it before and after the connection opens. Part of the lazy client chunk, not of any
 * page's first scripts: the facade in `socket.ts` replays what the page asked for before the
 * client arrived through this socket's `emit` and `timeout(ms).emit`.
 *
 * - `joinX` is remembered by room and payload, and sent when connected and not yet sent on this
 *   connection. An ack asked for before the server has answered waits for the answer; one asked
 *   for after it gets the answer at once, so a page's own join in its `connect` handler is acked on
 *   every connection (it is not sent again).
 * - `leaveX` forgets the room and tells the server if connected (else it never joined or will not
 *   rejoin). Its ack, and the timeout of a timed leave, are passed on as they are.
 * - `timeout(ms).emit("joinX", ..., ack)` is the same join; `ack` hears `(null, reply)` or, after
 *   `ms` without an answer, an Error, once.
 *
 * The `connect` handler is registered here, so it runs before any the page adds.
 */
export function keepRooms(socket: Socket): Socket {
  const rooms = new Map<string, Room>();
  const emit = socket.emit.bind(socket);
  const timeout = socket.timeout.bind(socket);

  function send(join: Room) {
    join.sent = true;
    join.reply = undefined;
    emit(join.event, ...join.args, (...reply: unknown[]) => {
      join.reply = reply;
      for (const ack of join.acks.splice(0)) ack(...reply);
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: emit arguments are passed through as given.
  function room(event: string, args: any[], ms?: number) {
    const last = args[args.length - 1];
    let ack: Room["acks"][number] | undefined = typeof last === "function" ? last : undefined;
    const payload = ack ? args.slice(0, -1) : args;
    const key = event.replace(/^(join|leave)/, "") + JSON.stringify(payload);
    if (!ROOM_EVENTS[event]) {
      if (rooms.delete(key) && socket.connected) emit(event, ...args);
      return;
    }
    if (ack && ms !== undefined) {
      const reply = ack;
      let waiting = true;
      setTimeout(() => {
        if (waiting) reply(new Error("operation has timed out"));
        waiting = false;
      }, ms);
      ack = (...answer) => {
        if (waiting) reply(null, ...answer);
        waiting = false;
      };
    }
    const join = rooms.get(key) ?? { event, args: payload, sent: false, acks: [] };
    rooms.set(key, join);
    if (socket.connected && join.sent && join.reply) ack?.(...join.reply);
    else if (ack) join.acks.push(ack);
    if (socket.connected && !join.sent) send(join);
  }

  socket.on("connect", () => {
    for (const join of rooms.values()) send(join);
  });
  socket.emit = ((event: string, ...args: unknown[]) => {
    if (Object.hasOwn(ROOM_EVENTS, event)) room(event, args);
    else emit(event, ...args);
    return socket;
  }) as Socket["emit"];
  socket.timeout = ((ms: number) => ({
    emit(event: string, ...args: unknown[]) {
      if (Object.hasOwn(ROOM_EVENTS, event)) room(event, args, ms);
      else {
        timeout(ms);
        emit(event, ...args);
      }
      return true;
    },
  })) as unknown as Socket["timeout"];
  return socket;
}
