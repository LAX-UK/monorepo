import type { Database } from "@auction/db";
import { shopOrderLine, shopProductionTask } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { ProductionWriter } from "../../application/ports/production.writer.js";
import { notFound } from "../../errors/shop-api-error.js";

export function createDrizzleProductionWriter(db: Database): ProductionWriter {
  return {
    async createTask(command) {
      const [line] = await db
        .select({ id: shopOrderLine.id })
        .from(shopOrderLine)
        .where(eq(shopOrderLine.id, command.orderLineId))
        .limit(1);
      if (!line) {
        throw notFound("Order line");
      }
      const [task] = await db
        .insert(shopProductionTask)
        .values({
          orderLineId: command.orderLineId,
          editionId: command.editionId,
          status: "queued",
          assignedToSubjectId: command.actorSubjectId,
        })
        .returning({ id: shopProductionTask.id });
      if (!task) {
        throw new Error("Failed to create production task");
      }
      return { taskId: task.id, status: "queued" };
    },
  };
}
