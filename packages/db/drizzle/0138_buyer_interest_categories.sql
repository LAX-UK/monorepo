INSERT INTO "category" ("id", "name", "slug", "sort_order")
VALUES
  ('c1000017-0000-4000-8000-000000000017', 'Jewellery', 'jewellery', 17),
  ('c1000018-0000-4000-8000-000000000018', 'Antiques', 'antiques', 18),
  ('c1000019-0000-4000-8000-000000000019', 'Memorabilia', 'memorabilia', 19)
ON CONFLICT DO NOTHING;
