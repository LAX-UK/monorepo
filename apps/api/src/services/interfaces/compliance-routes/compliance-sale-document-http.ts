import type { attachSaleDocumentBodySchema } from "@auction/validators";
import type { z } from "zod";
import type { ComplianceHttpJson, ComplianceViewerContext } from "./compliance-route-http.js";

export interface ISaleDocumentHttpApplicationService {
  list(saleId: string): Promise<ComplianceHttpJson>;

  attach(input: {
    saleId: string;
    body: z.infer<typeof attachSaleDocumentBodySchema>;
    viewer: ComplianceViewerContext;
  }): Promise<ComplianceHttpJson>;

  remove(saleId: string, documentId: string): Promise<ComplianceHttpJson>;
}
