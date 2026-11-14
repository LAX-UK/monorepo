# PR 1363, round 1: Bid admin client and staff rows open their page

Seeded local stack (dev seed), signed in as the seeded administrator. 1440x900 in light and dark, 375x812 light. Lot thumbnails are blank because file storage was not running locally.

| Screen | 1440 light | 1440 dark | 375 light |
|---|---|---|---|
| Clients list: rows open the client page | ![](clients-list-1440-light.png) | ![](clients-list-1440-dark.png) | ![](clients-list-375-light.png) |
| Client page opened from row 4 of the list: record pager "4 of 18" | ![](client-page-from-list-1440-light.png) | | |
| Clients after Back: the opened row is marked (Felix Nakamura) | ![](clients-after-back-1440-light.png) | ![](clients-after-back-1440-dark.png) | ![](clients-after-back-375-light.png) |
| Staff directory | ![](staff-list-1440-light.png) | ![](staff-list-1440-dark.png) | ![](staff-list-375-light.png) |
| Staff access review: rows open the staff page | ![](staff-access-review-1440-light.png) | ![](staff-access-review-1440-dark.png) | ![](staff-access-review-375-light.png) |
| Client page, Won lots tab: hovering a related row, which opens the lot | ![](client-related-table-1440-light.png) | ![](client-related-table-1440-dark.png) | ![](client-related-table-375-light.png) |

Note: the "after Back" shots were taken in a tab where another page was loaded first. When the list is the first page in the tab, the row is not marked on Back (shared kit issue, described in the PR).
