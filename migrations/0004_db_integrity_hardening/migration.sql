-- 1) Missing indexes for relational hot paths
CREATE INDEX IF NOT EXISTS "orders_user_id_idx" ON "orders" ("userId");
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items" ("orderId");
CREATE INDEX IF NOT EXISTS "order_items_product_id_idx" ON "order_items" ("productId");
CREATE INDEX IF NOT EXISTS "carts_user_id_idx" ON "carts" ("userId");
CREATE INDEX IF NOT EXISTS "cart_items_cart_id_idx" ON "cart_items" ("cartId");
CREATE INDEX IF NOT EXISTS "cart_items_product_id_idx" ON "cart_items" ("productId");
CREATE INDEX IF NOT EXISTS "wishlist_items_user_id_idx" ON "wishlist_items" ("userId");
CREATE INDEX IF NOT EXISTS "wishlist_items_product_id_idx" ON "wishlist_items" ("productId");
CREATE INDEX IF NOT EXISTS "addresses_user_id_idx" ON "addresses" ("userId");

-- 2) Composite unique constraints for duplicate prevention
DELETE FROM "cart_items" a
USING "cart_items" b
WHERE a."id" > b."id"
  AND a."cartId" = b."cartId"
  AND a."productId" = b."productId";

CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cart_id_product_id_uidx"
ON "cart_items" ("cartId", "productId");

DELETE FROM "wishlist_items" a
USING "wishlist_items" b
WHERE a."id" > b."id"
  AND a."userId" = b."userId"
  AND a."productId" = b."productId";

CREATE UNIQUE INDEX IF NOT EXISTS "wishlist_items_user_id_product_id_uidx"
ON "wishlist_items" ("userId", "productId");

-- 3) Nullable drift fix: orders.userId must be required
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "orders" WHERE "userId" IS NULL) THEN
    RAISE EXCEPTION 'orders.userId contains NULL values. Backfill user references before enforcing NOT NULL.';
  END IF;
END $$;

ALTER TABLE "orders"
ALTER COLUMN "userId" SET NOT NULL;
