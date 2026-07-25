import type { Redis } from "ioredis";
import type {
  IOAuthAttributionStore,
  OAuthAttributionProvider,
} from "../services/interfaces/oauth-attribution-store.js";

const SIGNUP_TTL_SEC = 30 * 60;
const OUTCOME_DEDUPE_TTL_SEC = 10 * 60;

export class RedisOAuthAttributionStore implements IOAuthAttributionStore {
  constructor(private readonly redis: Redis) {}

  async markNewUser(userId: string): Promise<void> {
    await this.redis.set(`marketing:new-user:${userId}`, "1", "EX", SIGNUP_TTL_SEC, "NX");
  }

  async completeNewUserAccount(userId: string, providerId: string): Promise<void> {
    await this.redis.eval(
      `
        if redis.call("EXISTS", KEYS[1]) ~= 1 then return 0 end
        redis.call("DEL", KEYS[1])
        if ARGV[1] == "google" or ARGV[1] == "apple" then
          redis.call("SET", KEYS[2], ARGV[1], "EX", ARGV[2], "NX")
          return 1
        end
        return 0
      `,
      2,
      `marketing:new-user:${userId}`,
      `marketing:oauth-signup:${userId}`,
      providerId,
      SIGNUP_TTL_SEC,
    );
  }

  async resolveOutcome(
    userId: string,
    provider: OAuthAttributionProvider,
  ): Promise<"ignored" | "login" | "signup"> {
    const result = await this.redis.eval(
      `
        if redis.call("EXISTS", KEYS[2]) == 1 then return "ignored" end
        redis.call("SET", KEYS[2], "1", "EX", ARGV[2])
        local signup = redis.call("GET", KEYS[1])
        if signup == ARGV[1] then
          redis.call("DEL", KEYS[1])
          return "signup"
        end
        return "login"
      `,
      2,
      `marketing:oauth-signup:${userId}`,
      `marketing:oauth-outcome:${userId}:${provider}`,
      provider,
      OUTCOME_DEDUPE_TTL_SEC,
    );
    return result === "signup" || result === "ignored" ? result : "login";
  }
}
