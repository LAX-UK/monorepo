import { z } from "zod";

const portalDocumentItemSchema = z.object({
  documentId: z.string().uuid(),
  kind: z.string(),
  createdAt: z.string(),
  downloadUrl: z.string().nullable(),
});

export const portalDocumentsResponseSchema = z.object({
  items: z.array(portalDocumentItemSchema),
});

export type PortalDocumentItem = z.infer<typeof portalDocumentItemSchema>;
