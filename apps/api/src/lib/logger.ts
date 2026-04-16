import type { Env } from "../env.js";

export type LogFields = Record<string, unknown>;

function line(level: string, msg: string, fields?: LogFields) {
  const payload = { level, msg, ts: new Date().toISOString(), ...fields };
  console.log(JSON.stringify(payload));
}

export function createAppLogger(env: Env) {
  const min = env.LOG_LEVEL;
  const order = ["fatal", "error", "warn", "info", "debug", "trace"] as const;
  const idx = order.indexOf(min as (typeof order)[number]);

  function enabled(level: (typeof order)[number]) {
    return order.indexOf(level) <= idx;
  }

  return {
    info(msg: string, fields?: LogFields) {
      if (enabled("info")) line("info", msg, fields);
    },
    warn(msg: string, fields?: LogFields) {
      if (enabled("warn")) line("warn", msg, fields);
    },
    error(msg: string, fields?: LogFields) {
      if (enabled("error")) line("error", msg, fields);
    },
  };
}

export type AppLogger = ReturnType<typeof createAppLogger>;
