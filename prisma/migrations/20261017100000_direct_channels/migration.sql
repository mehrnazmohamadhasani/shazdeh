-- Website, WhatsApp and phone orders are separate sales channels, each its
-- own row in Sales and on Today. The website keeps the existing direct
-- channel (renamed only if the owner hasn't renamed it); WhatsApp and
-- phone orders (Order.source) count under the two new direct channels.
UPDATE "Channel" SET "name" = 'Website', "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'direct' AND "name" = 'Website / WhatsApp';

INSERT INTO "Channel" ("id", "code", "name", "kind", "order", "updatedAt") VALUES
  ('ch_whatsapp', 'whatsapp', 'WhatsApp', 'DIRECT', 1, CURRENT_TIMESTAMP),
  ('ch_phone',    'phone',    'Phone',    'DIRECT', 2, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Delivery platforms follow the three direct channels.
UPDATE "Channel" SET "order" = "order" + 2 WHERE "kind" = 'PLATFORM' AND "order" >= 1 AND "order" <= 5 AND "id" IN ('ch_talabat', 'ch_careem', 'ch_deliveroo', 'ch_noon', 'ch_keeta');
