DELETE FROM "user_category_interest"
WHERE "category_id" IN (
  SELECT "id" FROM "category"
  WHERE ("id", "slug") IN (
    ('c1000017-0000-4000-8000-000000000017', 'jewellery'),
    ('c1000018-0000-4000-8000-000000000018', 'antiques'),
    ('c1000019-0000-4000-8000-000000000019', 'memorabilia')
  )
);

DELETE FROM "category"
WHERE ("id", "slug") IN (
  ('c1000017-0000-4000-8000-000000000017', 'jewellery'),
  ('c1000018-0000-4000-8000-000000000018', 'antiques'),
  ('c1000019-0000-4000-8000-000000000019', 'memorabilia')
);
