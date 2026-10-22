import type { ProductionTaskRepository } from "../application/ports/production-task.repository.js";

/** An empty task list for route tests; override methods as needed. */
export function createStubProductionTaskRepository(
  overrides: Partial<ProductionTaskRepository> = {},
): ProductionTaskRepository {
  return {
    list: async () => ({ items: [], nextCursor: null, counts: {} }),
    getDetail: async () => null,
    update: async () => ({ status: "not_found" }),
    listAssignees: async () => [],
    ...overrides,
  };
}
