# PR #1362 screenshots, round 1

Seeded local stack (throwaway Postgres 16 on 55432, `db:migrate`, `db:roles`, `db:seed:dev`, shop-api catalogue, demo and staff-operations seeds), signed in as the seeded administrator. For screenshots only, copies of the seeded orders (30 in total) and one dispute were added to the throwaway database. Taken with Playwright at 1440x900 (light and dark) and 375x812 (light), device scale 2.

## Orders list, sorted by total (sort now in the URL)

**1440-light**: `/orders?sort=-total`

![orders-list 1440-light](orders-list-1440-light.png)

**1440-dark**: `/orders?sort=-total`

![orders-list 1440-dark](orders-list-1440-dark.png)

**375-light**: `/orders?sort=-total`

![orders-list 375-light](orders-list-375-light.png)

## Orders after opening LAX-S-10003 and pressing Back: same sort and scroll, row focused and marked

**1440-light**: `/orders?sort=-total`

![orders-after-back 1440-light](orders-after-back-1440-light.png)

**1440-dark**: `/orders?sort=-total`

![orders-after-back 1440-dark](orders-after-back-1440-dark.png)

**375-light**: `/orders?sort=-total`

![orders-after-back 375-light](orders-after-back-375-light.png)

## Clients list: rows open the client page

**1440-light**: `/clients`

![clients-list 1440-light](clients-list-1440-light.png)

**1440-dark**: `/clients`

![clients-list 1440-dark](clients-list-1440-dark.png)

**375-light**: `/clients`

![clients-list 375-light](clients-list-375-light.png)

## Staff list: roles in the row, no panel; the name links to the Bid admin staff page (arrow and "opens Bid admin"); hovered on desktop

**1440-light**: `/staff`

![staff-list 1440-light](staff-list-1440-light.png)

**1440-dark**: `/staff`

![staff-list 1440-dark](staff-list-1440-dark.png)

**375-light**: `/staff`

![staff-list 375-light](staff-list-375-light.png)

## Disputes list (one local dispute added to the throwaway DB)

**1440-light**: `/disputes`

![disputes-list 1440-light](disputes-list-1440-light.png)

**1440-dark**: `/disputes`

![disputes-list 1440-dark](disputes-list-1440-dark.png)

**375-light**: `/disputes`

![disputes-list 375-light](disputes-list-375-light.png)

## Where a dispute row goes: its order at #payment

**1440-light**: `/orders/cc2beda2-0b79-49ab-a69b-855d1f7d39fb#payment`

![disputes-row-target 1440-light](disputes-row-target-1440-light.png)

**1440-dark**: `/orders/cc2beda2-0b79-49ab-a69b-855d1f7d39fb#payment`

![disputes-row-target 1440-dark](disputes-row-target-1440-dark.png)

**375-light**: `/orders/cc2beda2-0b79-49ab-a69b-855d1f7d39fb#payment`

![disputes-row-target 375-light](disputes-row-target-375-light.png)
