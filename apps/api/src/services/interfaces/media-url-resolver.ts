export interface IMediaUrlResolver {
  resolve(value: string | null | undefined): Promise<string | null>;

  resolveMany(values: readonly string[]): Promise<string[]>;

  resolveManyUnique(values: readonly string[]): Promise<Map<string, string>>;
}
