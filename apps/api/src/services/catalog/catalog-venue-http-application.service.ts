import type { CreateVenueInput, UpdateVenueInput } from "@auction/types";
import type { Result } from "neverthrow";
import type { VenueError } from "../../lib/errors.js";
import { serviceErrorJsonBody } from "../../lib/forbidden-response.js";
import type { CatalogHttpJson } from "../interfaces/catalog-routes/catalog-read-http.js";
import type { ICatalogVenueHttpApplicationService } from "../interfaces/catalog-routes/catalog-venue-http.js";
import type { VenueService } from "../venue.service.js";

function notFoundJson(): CatalogHttpJson {
  return { status: 404, body: { error: "Not found" } };
}

function fromVenueResult<T>(result: Result<T, VenueError>, okStatus = 200): CatalogHttpJson {
  if (result.isErr()) {
    return {
      status: result.error.status,
      body: serviceErrorJsonBody(result.error),
    };
  }
  return { status: okStatus, body: { data: result.value } };
}

export class CatalogVenueHttpApplicationService implements ICatalogVenueHttpApplicationService {
  constructor(private readonly venueService: VenueService) {}

  async list(input: {
    legalEntityId?: string;
    includeArchived: boolean;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<CatalogHttpJson> {
    const { venues, total } = await this.venueService.list({
      legalEntityId: input.legalEntityId,
      includeArchived: input.includeArchived,
      q: input.q,
      limit: input.limit,
      offset: input.offset,
    });
    return { status: 200, body: { data: venues, total } };
  }

  async get(input: { id: string }): Promise<CatalogHttpJson> {
    const data = await this.venueService.get(input.id);
    if (!data) return notFoundJson();
    const salesUsingCount = await this.venueService.getSalesUsingCount(input.id);
    return { status: 200, body: { data, usage: { salesUsingCount } } };
  }

  async create(input: { actorUserId: string; body: CreateVenueInput }): Promise<CatalogHttpJson> {
    const result = await this.venueService.create(input.body, { actorUserId: input.actorUserId });
    return fromVenueResult(result, 201);
  }

  async update(input: {
    actorUserId: string;
    id: string;
    body: UpdateVenueInput;
  }): Promise<CatalogHttpJson> {
    const result = await this.venueService.update(input.id, input.body, {
      actorUserId: input.actorUserId,
    });
    return fromVenueResult(result);
  }

  async archive(input: { actorUserId: string; id: string }): Promise<CatalogHttpJson> {
    const result = await this.venueService.archive(input.id, { actorUserId: input.actorUserId });
    return fromVenueResult(result);
  }
}
