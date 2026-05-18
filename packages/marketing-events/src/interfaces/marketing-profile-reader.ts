export type MarketingProfile = {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
};

export interface IMarketingProfileReader {
  getProfile(userId: string): Promise<MarketingProfile | null>;
}
