import type { Database } from "@auction/db";
import { publishUserProfileUpdated } from "@auction/db";

export async function publishIdentityProfileUpdated(
  db: Database,
  input: {
    subjectId: string;
    email?: string;
    name?: string;
    phone?: string | null;
  },
): Promise<void> {
  await publishUserProfileUpdated(
    db,
    {
      subjectId: input.subjectId,
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      updatedAt: new Date().toISOString(),
    },
    { producer: "apps/auth" },
  );
}
