-- Optional audit: sales/lots with HTTP(S) strings stored in cover_images / images JSON arrays.
-- Run manually after deploying admin presenters that keep storage keys on edit forms.

SELECT 'sales' AS entity, id, cover_images
FROM sales
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements_text(cover_images::jsonb) AS elem
  WHERE elem LIKE 'http%'
);

SELECT 'lots' AS entity, id, images
FROM lots
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements_text(images::jsonb) AS elem
  WHERE elem LIKE 'http%'
);
