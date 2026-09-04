import type { ContainerPaymentsServices } from "./create-payments-services.js";
import {
  type ContainerUserProfileServices,
  type CreateUserProfileServicesInput,
  createUserProfileServices,
} from "./create-user-profile-services.js";
import {
  type ContainerUserUtilityServices,
  createUserUtilityServices,
} from "./create-user-utility-services.js";

export type ContainerUserMiscServices = ContainerUserProfileServices & ContainerUserUtilityServices;

export type { ContainerUserProfileServices, ContainerUserUtilityServices };

export type CreateUserMiscServicesInput = CreateUserProfileServicesInput & {
  payments: ContainerPaymentsServices;
};

export function createUserMiscServices(
  input: CreateUserMiscServicesInput,
): ContainerUserMiscServices {
  const profile = createUserProfileServices(input);
  const utility = createUserUtilityServices({
    env: input.env,
    db: input.db,
    infra: input.infra,
    repos: input.repos,
    payments: input.payments,
  });
  return {
    ...profile,
    ...utility,
  };
}
