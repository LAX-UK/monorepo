"use client";

import { createPeopleListRouteError } from "@/components/admin/people/create-people-list-route-error";

export default createPeopleListRouteError({
  title: "Clients",
  backHref: "/admin/clients",
  backLabel: "Back to clients",
});
