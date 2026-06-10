UPDATE "onsite_event"
SET "segment_options" = '[
  {"value":"full_evening","label":"Full evening","helper":"Doors 6:00 PM through gala"},
  {"value":"auction_only","label":"Auction & preview","helper":"Arrive by 5:45 PM — live auction from 6:00 PM"},
  {"value":"gala_only","label":"Gala only","helper":"From 9:00 PM — celebration after the hammer"}
]'::jsonb
WHERE "slug" = 'lax001';
