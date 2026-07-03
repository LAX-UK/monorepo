/** Forces T to be resolved during typecheck (no runtime effect). */
export function defineCompileTimeContract<T>(): void {
  void (undefined as unknown as T);
}

export type AssertAssignable<T extends U, U> = T;
