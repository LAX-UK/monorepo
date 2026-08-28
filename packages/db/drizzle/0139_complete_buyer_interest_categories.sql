INSERT INTO "category" ("id", "name", "slug", "sort_order")
VALUES
  ('c1000001-0000-4000-8000-000000000001', 'Paintings', 'paintings', 1),
  ('c1000002-0000-4000-8000-000000000002', 'Sculpture', 'sculpture', 2),
  ('c1000005-0000-4000-8000-000000000005', 'Mixed Media', 'mixed-media', 5),
  ('c1000012-0000-4000-8000-000000000012', 'Watches & Clocks', 'watches-clocks', 12),
  ('c1000014-0000-4000-8000-000000000014', 'Coins & Medals', 'coins-medals', 14),
  ('c1000017-0000-4000-8000-000000000017', 'Jewellery', 'jewellery', 17),
  ('c1000018-0000-4000-8000-000000000018', 'Antiques', 'antiques', 18),
  ('c1000019-0000-4000-8000-000000000019', 'Memorabilia', 'memorabilia', 19)
ON CONFLICT DO NOTHING;
