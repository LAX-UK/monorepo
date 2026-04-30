# V1 Role Matrix

## Role Definitions

- **administrator**: full platform read/write.
- **accountant**: finance-only administration.
- **client**: marketplace user who can buy and/or sell using one account.

## Permission Matrix (V1)

| Capability Area | administrator | accountant | client |
|---|---|---|---|
| Manage users/roles | Yes | No | No |
| Send invites | Yes | No | No |
| Manage sales/lots lifecycle | Yes | No | No |
| Place bids (policy-permitted) | Contextual | No | Yes |
| Submit artwork | Yes | No | Yes |
| Approve submissions | Yes | No | No |
| Assign/override artist on lot | Yes | No | No |
| View payments/invoices | Yes | Yes | Limited to own transactions |
| Capture/refund/sync finance actions | Yes | Yes | No |
| View accounting reports | Yes | Yes | No |

## Notes

- Administrator is operational owner.
- Accountant scope is intentionally narrow to finance domains.
- Client role is action-context based (buyer/seller behavior, not separate identities).
