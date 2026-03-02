import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";



export const users = pgTable("users", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("passwordHash").notNull(),
  role: text("role").notNull().default("USER"),
  tokenVersion: integer("tokenVersion").notNull().default(0),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
  lastLogin: timestamp("lastLogin"),
  lastPasswordChange: timestamp("lastPasswordChange"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  imageUrl: text("imageUrl").notNull(),
  images: text("images").array().notNull().default(sql`'{}'::text[]`),
  variants: jsonb('variants').notNull().default([]),
  description: text("description"),
  stock: integer("stock").notNull().default(100),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const carts = pgTable("carts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("sessionId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cartId: varchar("cartId").notNull().references(() => carts.id, { onDelete: "cascade" }),
  productId: varchar("productId").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").references(() => users.id),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  deliveryCharge: decimal("deliveryCharge", { precision: 10, scale: 2 }),
  discount: decimal("discount", { precision: 10, scale: 2 }),
  promoCode: text("promoCode"),
  deliveryMethod: text("deliveryMethod"),
  paymentMethod: text("paymentMethod"),
  status: text("status").notNull().default("pending"),
  paymentStatus: text("paymentStatus").notNull().default("pending"),
  paymentProvider: text("paymentProvider"),
  paymentId: text("paymentId"),
  shippingName: text("shippingName").notNull(),
  shippingPhone: text("shippingPhone").notNull(),
  shippingAddress: text("shippingAddress").notNull(),
  shippingCity: text("shippingCity").notNull(),
  shippingState: text("shippingState").notNull(),
  shippingPinCode: text("shippingPinCode").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: varchar("productId").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  priceAtPurchase: decimal("priceAtPurchase", { precision: 10, scale: 2 }).notNull(),
});

export const addresses = pgTable("addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  addressLine: text("addressLine").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pinCode: text("pinCode").notNull(),
  isDefault: boolean("isDefault").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const wishlistItems = pgTable("wishlist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actorId").references(() => users.id),
  actorEmail: text("actorEmail"),
  eventType: text("eventType").notNull(),
  targetType: text("targetType"),
  targetId: text("targetId"),
  details: text("details"),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const adminSettings = pgTable("admin_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const orderNotes = pgTable("order_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  adminId: varchar("adminId").references(() => users.id),
  note: text("note").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, {
    fields: [carts.userId],
    references: [users.id],
  }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, {
    fields: [addresses.userId],
    references: [users.id],
  }),
}));

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  user: one(users, {
    fields: [wishlistItems.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [wishlistItems.productId],
    references: [products.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  wishlistItems: many(wishlistItems),
  orders: many(orders),
  carts: many(carts),
}));

export const insertUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().optional(),
});
export const productVariantSchema = z.object({
  color: z.string().min(1),
  hex: z.string().optional(),
  images: z.array(z.string()).min(1).max(8),
});
export const insertProductSchema = createInsertSchema(products).omit({ id: true }).extend({
  variants: z.array(productVariantSchema).max(10).optional(),
});
export const insertCartSchema = createInsertSchema(carts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCartItemSchema = createInsertSchema(cartItems).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  price: z.string().or(z.number()).optional(),
  category: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
  images: z.array(z.string()).max(8).optional(),
  variants: z.array(productVariantSchema).max(10).optional(),
  description: z.string().optional(),
  stock: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const orderStatusEnum = z.enum(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"]);
export const updateOrderStatusSchema = z.object({
  status: orderStatusEnum,
});

export const insertAddressSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  addressLine: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pinCode: z.string().min(5, "Valid PIN code is required"),
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  addressLine: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  pinCode: z.string().min(5).optional(),
  isDefault: z.boolean().optional(),
});

export const insertWishlistItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
});

export const updateUserProfileSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  phone: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export const insertAuditLogSchema = z.object({
  actorId: z.string().optional(),
  actorEmail: z.string().optional(),
  eventType: z.string(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  details: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export const insertOrderNoteSchema = z.object({
  orderId: z.string(),
  note: z.string().min(1),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
});

export const updateUserActiveSchema = z.object({
  active: z.boolean(),
});

export const adminProductsQuerySchema = z.object({
  page: z.string().optional().transform(val => parseInt(val || '1')),
  pageSize: z.string().optional().transform(val => parseInt(val || '20')),
  search: z.string().optional(),
  category: z.string().optional(),
  stockStatus: z.enum(['all', 'low', 'out']).optional(),
  sortBy: z.enum(['createdAt', 'price', 'stock', 'name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  active: z.string().optional(),
});

export const adminOrdersQuerySchema = z.object({
  page: z.string().optional().transform(val => parseInt(val || '1')),
  pageSize: z.string().optional().transform(val => parseInt(val || '20')),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));

export const orderNotesRelations = relations(orderNotes, ({ one }) => ({
  order: one(orders, {
    fields: [orderNotes.orderId],
    references: [orders.id],
  }),
  admin: one(users, {
    fields: [orderNotes.adminId],
    references: [users.id],
  }),
}));

export const contactSubmissions = pgTable("contact_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  orderId: text("orderId"),
  ticketNumber: text("ticketNumber").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  subscribedAt: timestamp("subscribedAt").notNull().defaultNow(),
});

export const insertContactSubmissionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  orderId: z.string().optional(),
});

export const insertNewsletterSubscriberSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export const passwordResets = pgTable("password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
