-- Read-only report: open bidding activity placed for an organisation by a member whose role
-- may not bid for it (finance, consignor, viewer, specialist). Owners, admins and buyer agents
-- may bid. Nothing here changes data: these bids stand, and organisation admins can cancel them.
-- "Member" is the person's active membership today; a removed member is not listed.

WITH non_bidding AS (
  SELECT legal_entity_id, user_id, role
  FROM legal_entity_member
  WHERE removed_at IS NULL
    AND role IN ('finance', 'consignor', 'viewer', 'specialist')
)
-- Live bids on lots that have not closed.
SELECT 'bid' AS kind, b.id, b.buyer_legal_entity_id, b.bidder_id AS user_id, m.role,
       b.lot_id, b.amount, b.placed_via, b.created_at
FROM bid b
JOIN lot l ON l.id = b.lot_id AND l.status IN ('scheduled', 'active')
JOIN non_bidding m ON m.legal_entity_id = b.buyer_legal_entity_id AND m.user_id = b.bidder_id
UNION ALL
-- Absentee (auto) bids waiting to run.
SELECT 'absentee_bid', a.id, a.buyer_legal_entity_id, a.user_id, m.role,
       a.lot_id, a.max_amount, 'absentee', a.placed_at
FROM absentee_bid a
JOIN non_bidding m ON m.legal_entity_id = a.buyer_legal_entity_id AND m.user_id = a.user_id
WHERE a.status IN ('scheduled', 'executing')
UNION ALL
-- Telephone bookings that have not finished.
SELECT 'telephone_booking', t.id, t.buyer_legal_entity_id, t.user_id, m.role,
       NULL::uuid, t.reserve_alt_max, 'telephone', t.created_at
FROM telephone_bid_booking t
JOIN non_bidding m ON m.legal_entity_id = t.buyer_legal_entity_id AND m.user_id = t.user_id
WHERE t.status IN ('requested', 'confirmed', 'in_progress')
ORDER BY 1, 3, 9;
