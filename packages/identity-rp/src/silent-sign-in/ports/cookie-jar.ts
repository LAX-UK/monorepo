export type CookieSetOptions = {
  maxAgeSeconds: number;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
};

export interface CookieJar {
  get(name: string): string | undefined;
  set(name: string, value: string, options: CookieSetOptions): void;
  delete(name: string): void;
}
