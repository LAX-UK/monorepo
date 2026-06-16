export type IssuedDisplayToken = {
  plainToken: string;
  tokenHash: string;
};

export interface IDisplayTokenIssuer {
  issueDeviceCode(): IssuedDisplayToken;
  issueDisplayToken(): IssuedDisplayToken;
  hash(plainToken: string): string;
  issueUserCode(): string;
}
