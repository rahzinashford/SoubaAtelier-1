CREATE INDEX IF NOT EXISTS products_active_idx ON "products" ("active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS orders_status_idx ON "orders" ("status");
