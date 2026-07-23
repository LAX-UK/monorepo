import type { attachLotDocumentBodySchema } from "@auction/validators";
import type { z } from "zod";
import type { ComplianceHttpJson, ComplianceViewerContext } from "./compliance-route-http.js";

export interface ILotDocumentHttpApplicationService {
  list(lotId: string): Promise<ComplianceHttpJson>;

  attach(input: {
    lotId: string;
    body: z.infer<typeof attachLotDocumentBodySchema>;
    viewer: ComplianceViewerContext;
  }): Promise<ComplianceHttpJson>;

  remove(lotId: string, documentId: string): Promise<ComplianceHttpJson>;
}
