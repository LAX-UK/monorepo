export type AdminApiForwardInput = {
  method: string;
  url: URL;
  accessToken: string;
  body?: ArrayBuffer | undefined;
  headers: Record<string, string>;
};

export type AdminApiForwardResult = {
  status: number;
  headers: Record<string, string>;
  body: ArrayBuffer;
};

export type AdminApiClient = {
  forward(input: AdminApiForwardInput): Promise<AdminApiForwardResult>;
};
