export type ProfileUpdateInput = {
  name?: string | undefined;
  image?: string | null | undefined;
};

export type UserAddressRow = {
  id: string;
  userId: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  addressType: "shipping" | "billing" | "both";
  isDefault: boolean;
  createdAt: Date;
};

export type CreateAddressInput = {
  label: string;
  line1: string;
  line2?: string | undefined;
  city: string;
  state?: string | undefined;
  postalCode: string;
  country: string;
  addressType?: "shipping" | "billing" | "both" | undefined;
  isDefault?: boolean | undefined;
};

export type UpdateAddressInput = Partial<CreateAddressInput> & {
  isDefault?: boolean | undefined;
};

export interface IProfileReader {
  getProfile(userId: string): Promise<{
    id: string;
    email: string;
    name: string;
    image: string | null;
    role: string;
    emailVerified: boolean;
    emailStatus: "ok" | "bounced" | "complained";
    emailStatusChangedAt: Date | null;
    hasSeenActingContextTooltip: boolean;
  } | null>;
}

export interface IProfileWriter {
  updateProfile(userId: string, input: ProfileUpdateInput): Promise<void>;
}

export interface IAddressRepository {
  listByUser(userId: string): Promise<UserAddressRow[]>;
  findByIdForUser(userId: string, addressId: string): Promise<UserAddressRow | null>;
  create(userId: string, input: CreateAddressInput): Promise<UserAddressRow>;
  update(
    userId: string,
    addressId: string,
    input: UpdateAddressInput,
  ): Promise<UserAddressRow | null>;
  delete(userId: string, addressId: string): Promise<boolean>;
  clearDefaultForUser(userId: string): Promise<void>;
  setDefault(userId: string, addressId: string): Promise<void>;
}
