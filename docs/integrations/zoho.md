# Zoho CRM

Region: EU.

- API host: `https://www.zohoapis.eu`
- Accounts host: `https://accounts.zoho.eu`

Register a server-side OAuth client at `https://api-console.zoho.eu`.

Recommended scopes:

- `ZohoCRM.modules.contacts.ALL`
- `ZohoCRM.modules.deals.ALL`
- `ZohoCRM.modules.sales_orders.ALL`
- `ZohoCRM.settings.fields.READ`

Required worker env:

- `ZOHO_API_HOST=https://www.zohoapis.eu`
- `ZOHO_ACCOUNTS_HOST=https://accounts.zoho.eu`
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`

Projection mapping:

- `user.registered` → `Contacts`
- `bid.lot_won` → `Deals`
- `order.paid` → `Sales_Orders`

The worker owns retries and rate-limit handling. If Zoho is down, `domain_events` remains the replay source.
