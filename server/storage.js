import { 
  users, products, carts, cartItems, orders, orderItems, addresses, wishlistItems, auditLogs, adminSettings, orderNotes, contactSubmissions, newsletterSubscribers
} from "../shared/schema.js";
import { db } from "./db.js";
import { eq, and, desc, asc, ilike, or, gte, lte, sql, count, sum } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export class DatabaseStorage {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserAuthSnapshot(id) {
    const [user] = await db.select({
      id: users.id,
      role: users.role,
      tokenVersion: users.tokenVersion,
      active: users.active,
    }).from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByName(name) {
    const [user] = await db.select().from(users).where(eq(users.name, name));
    return user || undefined;
  }

  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser) {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db.insert(users).values({
      id: randomUUID(),
      name: insertUser.name,
      email: insertUser.email,
      passwordHash: hashedPassword,
      role: insertUser.role || "USER"
    }).returning();
    return user;
  }

  async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async getAllProducts() {
  const rows = await db.select().from(products).where(eq(products.active, true));
  return rows.map(p => ({
    ...p,
    price: Number(p.price)
    }));
  }


  async getProduct(id) {
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) return undefined;

  return {
    ...product,
    price: Number(product.price)
  };
}


  async getProductByCode(code) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.code, code), eq(products.active, true)));
  if (!product) return undefined;

  return {
    ...product,
    price: Number(product.price)
  };
}


  async getProductByCodeIncludingInactive(code) {
  const [product] = await db.select().from(products).where(eq(products.code, code));
  if (!product) return undefined;

  return {
    ...product,
    price: Number(product.price)
  };
}


  async getProductsByCategory(category) {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.category, category), eq(products.active, true)));
  return rows.map(p => ({
    ...p,
    price: Number(p.price)
  }));
}

  async searchProducts(query) {
    const searchPattern = `%${query}%`;
    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.active, true),
          or(ilike(products.name, searchPattern), ilike(products.code, searchPattern))
        )
      );

    return rows.map(p => ({
      ...p,
      price: Number(p.price),
    }));
  }


  async createProduct(insertProduct) {
    try {
      const [product] = await db.insert(products).values({
        id: randomUUID(),
        ...insertProduct,
        price: String(insertProduct.price),
        images: insertProduct.images || [],
        variants: insertProduct.variants || [],
      }).returning();
      return {
        ...product,
        price: Number(product.price)
      };
    } catch (error) {
      console.error("Database error creating product:", error);
      throw error;
    }
  }

  async deleteProduct(id) {
    const [product] = await db
      .update(products)
      .set({ active: false })
      .where(eq(products.id, id))
      .returning();

    return Boolean(product);
  }

  async getCart(id) {
    const [cart] = await db.select().from(carts).where(eq(carts.id, id));
    return cart || undefined;
  }

  async getCartByUserId(userId) {
    const [cart] = await db.select().from(carts).where(eq(carts.userId, userId));
    return cart || undefined;
  }

  async getCartBySessionId(sessionId) {
    const [cart] = await db.select().from(carts).where(eq(carts.sessionId, sessionId));
    return cart || undefined;
  }

  async createCart(insertCart) {
    const [cart] = await db.insert(carts).values({
      id: randomUUID(),
      ...insertCart,
      updatedAt: new Date()
    }).returning();
    return cart;
  }

  async updateCartTimestamp(cartId) {
    await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
  }

  async getCartItems(cartId) {
    const items = await db
      .select()
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, cartId));
    
    return items.map(item => ({
      ...item.cart_items,
      product: item.products
    }));
  }

  async addCartItem(item) {
    const [cartItem] = await db.insert(cartItems).values({
      id: randomUUID(),
      ...item
    }).returning();
    return cartItem;
  }

  async updateCartItemQuantity(id, quantity) {
    await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, id));
  }

  async removeCartItem(id) {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  }

  async clearCart(cartId) {
    await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
  }

  async createOrder(insertOrder) {
    const [order] = await db.insert(orders).values({
      id: randomUUID(),
      ...insertOrder
    }).returning();
    return order;
  }

  async createOrderItem(item) {
    const [orderItem] = await db.insert(orderItems).values({
      id: randomUUID(),
      ...item
    }).returning();
    return orderItem;
  }

  mapOrdersWithItems(rows) {
    const grouped = new Map();

    for (const row of rows) {
      const orderId = row.order.id;
      if (!grouped.has(orderId)) {
        grouped.set(orderId, {
          ...row.order,
          user: row.user?.id ? row.user : undefined,
          items: [],
        });
      }

      if (row.item?.id) {
        grouped.get(orderId).items.push({
          ...row.item,
          product: row.product,
        });
      }
    }

    return Array.from(grouped.values());
  }

  async getOrdersByUserId(userId) {
    const rows = await db
      .select({
        order: orders,
        item: orderItems,
        product: products,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));

    return this.mapOrdersWithItems(rows);
  }

  async getOrder(id) {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrderItems(orderId) {
    const items = await db
      .select()
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId));

    return items.map(item => ({
      ...item.order_items,
      product: item.products,
    }));
  }

  async getAllOrders() {
    const rows = await db
      .select({
        order: orders,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        item: orderItems,
        product: products,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .leftJoin(products, eq(orderItems.productId, products.id))
      .orderBy(desc(orders.createdAt));

    return this.mapOrdersWithItems(rows);
  }

  async updateOrderStatus(id, status) {
    const [order] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    return order || undefined;
  }

  async updateUserProfile(id, data) {
    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;

    if (Object.keys(updateData).length === 0) {
      return this.getUser(id);
    }

    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async updateUserPassword(id, newPasswordHash) {
    const [user] = await db.update(users).set({ 
      passwordHash: newPasswordHash,
      lastPasswordChange: new Date(),
      tokenVersion: sql`${users.tokenVersion} + 1`,
    }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  // ===== Password reset helpers =====

async setPasswordResetToken(userId, token, expires) {
  await db.update(users).set({
    resetPasswordToken: token,
    resetPasswordExpires: expires,
  }).where(eq(users.id, userId));
}

async getUserByResetToken(token) {
  const [user] = await db.select()
    .from(users)
    .where(eq(users.resetPasswordToken, token));

  return user || undefined;
}

async clearPasswordResetToken(userId) {
  await db.update(users).set({
    resetPasswordToken: null,
    resetPasswordExpires: null,
  }).where(eq(users.id, userId));
}

  async getAddressesByUserId(userId) {
    return await db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.createdAt));
  }

  async getAddress(id) {
    const [address] = await db.select().from(addresses).where(eq(addresses.id, id));
    return address || undefined;
  }

  async createAddress(userId, insertAddress) {
    if (insertAddress.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    }
    const [address] = await db.insert(addresses).values({
      id: randomUUID(),
      userId,
      ...insertAddress
    }).returning();
    return address;
  }

  async updateAddress(id, data) {
    const existingAddress = await this.getAddress(id);
    if (!existingAddress) return undefined;

    if (data.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, existingAddress.userId));
    }

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.addressLine !== undefined) updateData.addressLine = data.addressLine;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.pinCode !== undefined) updateData.pinCode = data.pinCode;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    if (Object.keys(updateData).length === 0) {
      return existingAddress;
    }

    const [address] = await db.update(addresses).set(updateData).where(eq(addresses.id, id)).returning();
    return address || undefined;
  }

  async deleteAddress(id) {
    const result = await db.delete(addresses).where(eq(addresses.id, id)).returning();
    return result.length > 0;
  }

  async setDefaultAddress(userId, addressId) {
    await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    const [address] = await db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, addressId)).returning();
    return address || undefined;
  }

  async getWishlistByUserId(userId) {
    const items = await db
      .select()
      .from(wishlistItems)
      .innerJoin(products, eq(wishlistItems.productId, products.id))
      .where(eq(wishlistItems.userId, userId))
      .orderBy(desc(wishlistItems.createdAt));
    
    return items.map(item => ({
      ...item.wishlist_items,
      product: item.products
    }));
  }

  async getWishlistItem(userId, productId) {
    const [item] = await db.select().from(wishlistItems).where(
      and(
        eq(wishlistItems.userId, userId),
        eq(wishlistItems.productId, productId)
      )
    );
    return item || undefined;
  }

  async addToWishlist(userId, productId) {
    const existing = await this.getWishlistItem(userId, productId);
    if (existing) {
      return existing;
    }
    const [item] = await db.insert(wishlistItems).values({
      id: randomUUID(),
      userId,
      productId
    }).returning();
    return item;
  }

  async removeFromWishlist(userId, productId) {
    const result = await db.delete(wishlistItems).where(
      and(
        eq(wishlistItems.userId, userId),
        eq(wishlistItems.productId, productId)
      )
    ).returning();
    return result.length > 0;
  }

  async isInWishlist(userId, productId) {
    const item = await this.getWishlistItem(userId, productId);
    return !!item;
  }

  async updateProduct(id, data) {
    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.price !== undefined) updateData.price = String(data.price);
    if (data.category !== undefined) updateData.category = data.category;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.images !== undefined) updateData.images = data.images;
    if (data.variants !== undefined) updateData.variants = data.variants;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.active !== undefined) updateData.active = data.active;

    if (Object.keys(updateData).length === 0) {
      return this.getProduct(id);
    }

    const [product] = await db.update(products).set(updateData).where(eq(products.id, id)).returning();
    return product || undefined;
  }

  async getAllUsers() {
    return await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt));
  }

  async getUsersWithPagination(params) {
    const { page = 1, pageSize = 20, search, role, active } = params;
    const offset = (page - 1) * pageSize;
    
    let conditions = [];
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(or(
        ilike(users.name, searchPattern),
        ilike(users.email, searchPattern)
      ));
    }
    if (role) {
      conditions.push(eq(users.role, role));
    }
    if (active !== undefined) {
      conditions.push(eq(users.active, active === 'true'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db.select({ count: count() }).from(users).where(whereClause);
    const total = totalResult?.count || 0;

    const items = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    }).from(users).where(whereClause).orderBy(desc(users.createdAt)).limit(pageSize).offset(offset);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async updateUserRole(id, role) {
    const [user] = await db.update(users).set({
      role,
      tokenVersion: sql`${users.tokenVersion} + 1`,
    }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async updateUserActive(id, active) {
    const [user] = await db.update(users).set({ active }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async revokeUserSessions(id) {
    const [user] = await db.update(users).set({
      tokenVersion: sql`${users.tokenVersion} + 1`,
    }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async updateUserLastLogin(id) {
    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, id));
  }

  async getAdminProductsPaginated(params) {
    const { page = 1, pageSize = 20, search, category, stockStatus, sortBy = 'createdAt', sortOrder = 'desc', active } = params;
    const offset = (page - 1) * pageSize;
    
    let conditions = [];
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(or(
        ilike(products.name, searchPattern),
        ilike(products.code, searchPattern)
      ));
    }
    if (category) {
      conditions.push(eq(products.category, category));
    }
    if (stockStatus === 'low') {
      conditions.push(and(gte(products.stock, 1), lte(products.stock, 10)));
    } else if (stockStatus === 'out') {
      conditions.push(eq(products.stock, 0));
    }
    if (active !== undefined) {
      conditions.push(eq(products.active, active === 'true'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db.select({ count: count() }).from(products).where(whereClause);
    const total = totalResult?.count || 0;

    let orderByClause;
    if (sortBy === 'price') {
      orderByClause = sortOrder === 'asc' ? asc(products.price) : desc(products.price);
    } else if (sortBy === 'stock') {
      orderByClause = sortOrder === 'asc' ? asc(products.stock) : desc(products.stock);
    } else if (sortBy === 'name') {
      orderByClause = sortOrder === 'asc' ? asc(products.name) : desc(products.name);
    } else {
      orderByClause = sortOrder === 'asc' ? asc(products.createdAt) : desc(products.createdAt);
    }

    const items = await db.select().from(products).where(whereClause).orderBy(orderByClause).limit(pageSize).offset(offset);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getProductCategories() {
    const result = await db.selectDistinct({ category: products.category }).from(products);
    return result.map(r => r.category);
  }

  async getAdminOrdersPaginated(params) {
    const { page = 1, pageSize = 20, status, paymentStatus, search, dateFrom, dateTo } = params;
    const offset = (page - 1) * pageSize;
    
    let conditions = [];
    if (status) {
      conditions.push(eq(orders.status, status));
    }
    if (paymentStatus) {
      conditions.push(eq(orders.paymentStatus, paymentStatus));
    }
    if (dateFrom) {
      conditions.push(gte(orders.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(orders.createdAt, new Date(dateTo)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db.select({ count: count() }).from(orders).where(whereClause);
    const total = totalResult?.count || 0;

    const allOrders = await db
      .select({
        order: orders,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset);

    let items = allOrders.map(row => ({
      ...row.order,
      user: row.user || undefined,
    }));

    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(o => 
        o.id.toLowerCase().includes(searchLower) ||
        o.user?.email?.toLowerCase().includes(searchLower) ||
        o.shippingName?.toLowerCase().includes(searchLower)
      );
    }

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getLowStockProducts(threshold = 10) {
    return await db.select().from(products).where(lte(products.stock, threshold)).orderBy(asc(products.stock));
  }

  async adjustProductStock(id, adjustment) {
    const product = await this.getProduct(id);
    if (!product) return undefined;
    const newStock = Math.max(0, product.stock + adjustment);
    const [updated] = await db.update(products).set({ stock: newStock }).where(eq(products.id, id)).returning();
    return updated;
  }

  async bulkUpdateProducts(ids, data) {
    const results = [];
    for (const id of ids) {
      const updated = await this.updateProduct(id, data);
      if (updated) results.push(updated);
    }
    return results;
  }

  async bulkImportProducts(productsData) {
    const results = { created: 0, updated: 0, errors: [] };
    
    for (const prod of productsData) {
      try {
        const existing = await this.getProductByCodeIncludingInactive(prod.code);
        if (existing) {
          await this.updateProduct(existing.id, prod);
          results.updated++;
        } else {
          await this.createProduct(prod);
          results.created++;
        }
      } catch (error) {
        results.errors.push({ code: prod.code, error: error.message });
      }
    }
    
    return results;
  }

  async createAuditLog(logData) {
    const [log] = await db.insert(auditLogs).values({
      id: randomUUID(),
      ...logData,
    }).returning();
    return log;
  }

  async getAuditLogs(params) {
    const { page = 1, pageSize = 50, eventType, actorId, dateFrom, dateTo } = params;
    const offset = (page - 1) * pageSize;
    
    let conditions = [];
    if (eventType) {
      conditions.push(eq(auditLogs.eventType, eventType));
    }
    if (actorId) {
      conditions.push(eq(auditLogs.actorId, actorId));
    }
    if (dateFrom) {
      conditions.push(gte(auditLogs.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(auditLogs.createdAt, new Date(dateTo)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db.select({ count: count() }).from(auditLogs).where(whereClause);
    const total = totalResult?.count || 0;

    const items = await db.select().from(auditLogs).where(whereClause).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset(offset);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getRecentAuditLogs(limit = 20) {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  }

  async getAdminSetting(key) {
    const [setting] = await db.select().from(adminSettings).where(eq(adminSettings.key, key));
    return setting?.value;
  }

  async setAdminSetting(key, value) {
    const existing = await this.getAdminSetting(key);
    if (existing !== undefined) {
      await db.update(adminSettings).set({ value, updatedAt: new Date() }).where(eq(adminSettings.key, key));
    } else {
      await db.insert(adminSettings).values({ id: randomUUID(), key, value });
    }
  }

  async getAllAdminSettings() {
    const settings = await db.select().from(adminSettings);
    return settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
  }

  async createOrderNote(orderId, adminId, note) {
    const [orderNote] = await db.insert(orderNotes).values({
      id: randomUUID(),
      orderId,
      adminId,
      note,
    }).returning();
    return orderNote;
  }

  async getOrderNotes(orderId) {
    const notes = await db
      .select({
        note: orderNotes,
        admin: {
          id: users.id,
          name: users.name,
        },
      })
      .from(orderNotes)
      .leftJoin(users, eq(orderNotes.adminId, users.id))
      .where(eq(orderNotes.orderId, orderId))
      .orderBy(desc(orderNotes.createdAt));
    
    return notes.map(n => ({
      ...n.note,
      adminName: n.admin?.name,
    }));
  }

  async getAdminOverviewStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalProducts] = await db.select({ count: count() }).from(products);
    const [totalOrders30d] = await db.select({ count: count() }).from(orders).where(gte(orders.createdAt, thirtyDaysAgo));
    const [revenue30d] = await db.select({ total: sum(orders.totalAmount) }).from(orders).where(
      and(gte(orders.createdAt, thirtyDaysAgo), or(eq(orders.status, 'PAID'), eq(orders.status, 'SHIPPED'), eq(orders.status, 'DELIVERED')))
    );
    const [pendingOrders] = await db.select({ count: count() }).from(orders).where(eq(orders.status, 'PENDING'));
    const [lowStockCount] = await db.select({ count: count() }).from(products).where(lte(products.stock, 10));

    return {
      totalProducts: totalProducts?.count || 0,
      totalOrders30d: totalOrders30d?.count || 0,
      revenue30d: parseFloat(revenue30d?.total || 0),
      pendingOrders: pendingOrders?.count || 0,
      lowStockCount: lowStockCount?.count || 0,
    };
  }

  async getSalesTimeseries(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const allOrders = await db.select({
      date: orders.createdAt,
      amount: orders.totalAmount,
    }).from(orders).where(gte(orders.createdAt, startDate));

    const salesByDay = {};
    for (let i = 0; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      salesByDay[key] = 0;
    }

    for (const order of allOrders) {
      const key = new Date(order.date).toISOString().split('T')[0];
      if (salesByDay[key] !== undefined) {
        salesByDay[key] += parseFloat(order.amount || 0);
      }
    }

    return Object.entries(salesByDay)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getOrdersByStatus() {
    const statuses = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    const result = [];
    
    for (const status of statuses) {
      const [countResult] = await db.select({ count: count() }).from(orders).where(eq(orders.status, status));
      result.push({ status, count: countResult?.count || 0 });
    }
    
    return result;
  }

  async getTopProducts(limit = 10) {
    const result = await db
      .select({
        productId: orderItems.productId,
        productName: products.name,
        productCode: products.code,
        totalSold: sum(orderItems.quantity),
        revenue: sum(sql`${orderItems.quantity} * ${orderItems.priceAtPurchase}`),
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .groupBy(orderItems.productId, products.name, products.code)
      .orderBy(desc(sum(orderItems.quantity)))
      .limit(limit);
    
    return result.map(r => ({
      productId: r.productId,
      productName: r.productName,
      productCode: r.productCode,
      totalSold: parseInt(r.totalSold) || 0,
      revenue: parseFloat(r.revenue) || 0,
    }));
  }

  async getUserOrdersSummary(userId) {
    const userOrders = await db.select().from(orders).where(eq(orders.userId, userId));
    const totalOrders = userOrders.length;
    const totalSpent = userOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);
    return { totalOrders, totalSpent };
  }

  async createContactSubmission(data) {
    const ticketNumber = `TKT${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const [submission] = await db.insert(contactSubmissions).values({
      id: randomUUID(),
      ...data,
      ticketNumber,
    }).returning();
    return submission;
  }

  async getContactSubmissions(params = {}) {
    const { page = 1, pageSize = 20, status } = params;
    const offset = (page - 1) * pageSize;
    
    let conditions = [];
    if (status) {
      conditions.push(eq(contactSubmissions.status, status));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db.select({ count: count() }).from(contactSubmissions).where(whereClause);
    const total = totalResult?.count || 0;
    const items = await db.select().from(contactSubmissions).where(whereClause).orderBy(desc(contactSubmissions.createdAt)).limit(pageSize).offset(offset);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async subscribeNewsletter(email) {
    const existing = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email));
    if (existing.length > 0) {
      return { alreadySubscribed: true, subscriber: existing[0] };
    }
    const [subscriber] = await db.insert(newsletterSubscribers).values({
      id: randomUUID(),
      email,
    }).returning();
    return { alreadySubscribed: false, subscriber };
  }

  async getNewsletterSubscribers() {
    return await db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.subscribedAt));
  }
}


export const storage = new DatabaseStorage();
