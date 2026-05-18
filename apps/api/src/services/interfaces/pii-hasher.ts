export interface IPiiHasher {
  hashEmail(value: string): string;
  hashPhone(value: string): string;
  hashName(value: string): string;
  hashExternalId(value: string): string;
}
