# DB Index Hardening Report

## Scope
Added missing indexes for high-frequency filter fields in Drizzle schema and created an idempotent SQL migration.

## Before vs After Schema Snippet

### Products table

**Before**
```js
export const products = pgTable("products", {
  // ...
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
```

**After**
```js
export const products = pgTable("products", {
  // ...
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => ({
  activeIdx: index("products_active_idx").on(table.active),
}));
```

### Orders table

**Before**
```js
}, (table) => ({
  userIdIdx: index("orders_user_id_idx").on(table.userId),
  createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
}));
```

**After**
```js
}, (table) => ({
  userIdIdx: index("orders_user_id_idx").on(table.userId),
  createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
  statusIdx: index("orders_status_idx").on(table.status),
}));
```

## Migration SQL
Created `migrations/0002_products_active_orders_status_idx.sql`:

```sql
CREATE INDEX IF NOT EXISTS products_active_idx ON "products" ("active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS orders_status_idx ON "orders" ("status");
```

## Confirmation
- ✅ Migration file created.
- ✅ No duplicate index conflicts (uses `IF NOT EXISTS` for both indexes).
- ✅ Index names align with existing pattern (`<table>_<column>_idx`).
- ✅ Build passes.
