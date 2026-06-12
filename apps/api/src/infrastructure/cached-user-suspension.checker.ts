import type { ICacheProvider } from "../services/interfaces/cache.js";
import type { IUserSuspensionChecker } from "../services/interfaces/user-suspension.js";

const cacheKey = (userId: string) => `user:${userId}:suspended`;

export class CachedUserSuspensionChecker implements IUserSuspensionChecker {
  constructor(
    private readonly delegate: IUserSuspensionChecker,
    private readonly cache: ICacheProvider,
    private readonly ttlSec = 60,
  ) {}

  async isSuspended(userId: string): Promise<boolean> {
    const cached = await this.cache.get(cacheKey(userId));
    if (cached === "1") return true;
    if (cached === "0") return false;
    const suspended = await this.delegate.isSuspended(userId);
    await this.cache.set(cacheKey(userId), suspended ? "1" : "0", this.ttlSec);
    return suspended;
  }

  async invalidate(userId: string): Promise<void> {
    await this.cache.del(cacheKey(userId));
  }
}
