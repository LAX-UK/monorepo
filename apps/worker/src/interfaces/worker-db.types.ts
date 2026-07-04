export type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

export type ProjectorDbConnection = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];
