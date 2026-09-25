import type { AccountOnboardingService } from "../services/account-onboarding.service.js";
import type { ICacheProvider } from "../services/interfaces/cache.js";

const cacheKey = (userId: string) => `user:${userId}:onboarding_complete`;

/** Redis-backed cache for account onboarding completion (avoids DB reads on every bid). */
export class CachedAccountOnboardingChecker {
  constructor(
    private readonly onboarding: AccountOnboardingService,
    private readonly cache: ICacheProvider,
    private readonly ttlSec = 60,
  ) {}

  async isComplete(userId: string): Promise<boolean> {
    const cached = await this.cache.get(cacheKey(userId));
    if (cached === "1") return true;
    if (cached === "0") return false;
    const { complete } = await this.onboarding.getStatus(userId);
    await this.cache.set(cacheKey(userId), complete ? "1" : "0", this.ttlSec);
    return complete;
  }

  async invalidate(userId: string): Promise<void> {
    await this.cache.del(cacheKey(userId));
  }
}
