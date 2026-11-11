export type SignOutContextLike = {
  request: {
    post(
      url: string,
      options: {
        headers: Record<string, string>;
        maxRedirects: number;
        failOnStatusCode: boolean;
      },
    ): Promise<{
      status(): number;
      headers(): Record<string, string>;
      json(): Promise<unknown>;
    }>;
  };
  newPage(): Promise<{
    goto(url: string, options: { waitUntil: "domcontentloaded" }): Promise<unknown>;
    close(): Promise<void>;
  }>;
};

export type SignOutTarget = { origin: string; logoutPath?: string };

export const DEFAULT_LOGOUT_PATH: string;

export function endSessionTarget(
  response: { status: number; headers: Record<string, string>; body: unknown },
  origin: string,
): string | null;

export function signOutContext(context: SignOutContextLike, target: SignOutTarget): Promise<void>;

export function signOutStorageStates(
  browser: {
    newContext(options: { storageState: string }): Promise<
      SignOutContextLike & { close(): Promise<void> }
    >;
  },
  input: SignOutTarget & { files: readonly string[] },
): Promise<string[]>;

export function rememberSignIn<Context extends object>(
  context: Context,
  signOut: (context: Context) => Promise<void>,
): void;
export function forgetSignIn(context: object): void;
export function signOutRememberedSignIns(): Promise<void>;

/** Returns the same `test`, extended; typed loosely so each app keeps its own fixtures' types. */
export function withSignOutAfterEach<T>(base: T): T;
