import type { IdentityEventPublisher } from "@auction/auth";

export async function publishIdentityProfileUpdated(
  publisher: IdentityEventPublisher,
  input: {
    subjectId: string;
    email?: string;
    name?: string;
    phone?: string | null;
    phoneVerified?: boolean;
    image?: string | null;
  },
  options?: { transaction?: unknown },
): Promise<void> {
  await publisher.publish(
    {
      type: "user.profile_updated",
      userId: input.subjectId,
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.phoneVerified !== undefined ? { phoneVerified: input.phoneVerified } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
    },
    { producer: "apps/auth", transaction: options?.transaction },
  );
}
