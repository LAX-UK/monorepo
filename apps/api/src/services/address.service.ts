import type {
  CreateAddressInput,
  IAddressRepository,
  UpdateAddressInput,
} from "@auction/persistence/interfaces";

export class AddressService {
  constructor(private readonly addresses: IAddressRepository) {}

  list(userId: string) {
    return this.addresses.listByUser(userId);
  }

  create(userId: string, input: CreateAddressInput) {
    return this.addresses.create(userId, input);
  }

  update(userId: string, addressId: string, input: UpdateAddressInput) {
    return this.addresses.update(userId, addressId, input);
  }

  delete(userId: string, addressId: string) {
    return this.addresses.delete(userId, addressId);
  }

  setDefault(userId: string, addressId: string) {
    return this.addresses.setDefault(userId, addressId);
  }
}
