/** Veriff-documented watchlist payloads for tests (see devdocs.veriff.com). */

export const VERIFF_WATCHLIST_MATCH_FOUND = {
  status: "success",
  data: {
    attemptId: "aea9ba6d-1b47-47fc-a4fc-f72b6d3584a7",
    sessionId: "f04bdb47-d3be-4b28-b028-a652feb060b5",
    vendorData: "user_test_123",
    endUserId: "c1de400b-1877-4284-8494-071d37916197",
    checkType: "initial_result",
    matchStatus: "possible_match",
    monitorStatus: "enabled",
    searchTerm: {
      name: "GADDAFI",
      year: "1942",
      lists: ["SANCTIONS", "PEP_CLASS_1", "PEP_CLASS_2"],
      countries: ["US", "GB", "FR"],
      exactMatch: "false",
      matchThreshold: "80",
      excludeDeceased: "true",
    },
    totalHits: "1",
    createdAt: "2021-07-05T13:23:59.851Z",
    hits: [
      {
        matchedName: "Mouammar Mohammed Abu Minyar Kadhafi",
        countries: ["Libya", "US"],
        dateOfBirth: "1942",
        dateOfDeath: "2011",
        matchTypes: ["matching_name"],
        aka: ["Moammar Qaddafi", "Muammar Gaddafi"],
        associates: ["Saif al-Islam Gaddafi"],
        listingsRelatedToMatch: {
          warnings: [],
          sanctions: [
            {
              sourceName: "UN Security Council Sanctions",
              sourceUrl: "https://www.un.org/securitycouncil/sanctions",
              date: "2011-02-26",
            },
          ],
          fitnessProbity: [],
          pep: [
            {
              sourceName: "ComplyAdvantage PEP data",
              sourceUrl: null,
              date: null,
            },
          ],
          adverseMedia: [
            {
              sourceName: "International Media Coverage",
              snippet: "Former aide of Libyan leader Colonel Muammar Gaddafi",
              sourceUrl: null,
              date: "2011-03-15",
            },
          ],
        },
      },
    ],
  },
} as const;

export const VERIFF_WATCHLIST_NO_MATCH = {
  status: "success",
  data: {
    attemptId: "aea9ba6d-1b47-47fc-a4fc-f72b6d3584a7",
    sessionId: "f04bdb47-d3be-4b28-b028-a652feb060b5",
    vendorData: "user_test_456",
    checkType: "initial_result",
    matchStatus: "no_match",
    monitorStatus: "enabled",
    searchTerm: {
      name: "JOHN SMITH",
      year: "1985",
      lists: ["SANCTIONS", "PEP_CLASS_1"],
      countries: ["US"],
    },
    totalHits: "0",
    createdAt: "2021-07-05T13:23:59.851Z",
    hits: [],
  },
} as const;

export const VERIFF_WATCHLIST_MONITORING_UPDATE = {
  status: "success",
  data: {
    attemptId: "aea9ba6d-1b47-47fc-a4fc-f72b6d3584a7",
    sessionId: "f04bdb47-d3be-4b28-b028-a652feb060b5",
    vendorData: "user_test_789",
    checkType: "updated_result",
    matchStatus: "possible_match",
    monitorStatus: "enabled",
    searchTerm: {
      name: "MARIA SANTOS",
      year: "1978",
      lists: ["SANCTIONS", "PEP_CLASS_1"],
      countries: ["BR", "US"],
    },
    totalHits: "1",
    createdAt: "2021-07-15T08:45:22.123Z",
    hits: [
      {
        matchedName: "Maria Santos Silva",
        countries: ["Brazil"],
        dateOfBirth: "1978",
        matchTypes: ["matching_name", "year_of_birth"],
        aka: ["Maria S. Silva"],
        associates: [],
        listingsRelatedToMatch: {
          warnings: [],
          sanctions: [],
          fitnessProbity: [],
          pep: [
            {
              sourceName: "Brazil Government Officials Database",
              sourceUrl: null,
              date: "2021-07-14",
            },
          ],
          adverseMedia: [
            {
              sourceName: "Local News Reports",
              snippet: "Government official mentioned in local coverage",
              sourceUrl: null,
              date: "2021-07-10",
            },
          ],
        },
      },
    ],
  },
} as const;
