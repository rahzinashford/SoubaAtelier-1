import { storage } from "./storage.js";
import { insertProductSchema, insertUserSchema, insertCartItemSchema, insertOrderSchema, insertOrderItemSchema, updateProductSchema, updateOrderStatusSchema, insertAddressSchema, updateAddressSchema, insertWishlistItemSchema, updateUserProfileSchema, changePasswordSchema, updateUserRoleSchema, updateUserActiveSchema, insertOrderNoteSchema, insertContactSubmissionSchema, insertNewsletterSubscriberSchema } from "../shared/schema.js";
import { z } from "zod";
import { signToken } from "./utils/jwt.js";
import { requireAuth, requireAdmin } from "./middlewares/auth.js";
import bcrypt from "bcryptjs";
import { authLimiter, adminLimiter, checkoutLimiter, contactLimiter } from "./middlewares/rateLimit.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { db } from "./db.js";
import { cartItems, carts, orderItems, orders, products } from "../shared/schema.js";
import { and, eq, inArray, sql } from "drizzle-orm";

const uploadDir = path.join(process.cwd(), "uploads", "products");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage_multer = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage_multer,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

function createAuditLog(storage, req, eventType, targetType, targetId, details) {
  return storage.createAuditLog({
    actorId: req.user?.id,
    actorEmail: req.user?.email,
    eventType,
    targetType,
    targetId,
    details: typeof details === 'object' ? JSON.stringify(details) : details,
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
}

export async function registerRoutes(httpServer, app) {
  
  app.use("/api/admin", requireAuth, requireAdmin);

  app.post("/api/admin/uploads/images", requireAuth, requireAdmin, upload.array("images", 8), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }
      
      const urls = req.files.map(file => `/uploads/products/${file.filename}`);
      res.json(urls);
    } catch (error) {
      res.status(500).json({ message: "Upload failed" });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", message: "Backend working" });
  });

  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/search", async (req, res) => {
    try {
      const query = req.query.q;
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }
      const products = await storage.searchProducts(query);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  app.get("/api/products/category/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const products = await storage.getProductsByCategory(category);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products by category" });
    }
  });

  app.get("/api/products/code/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const product = await storage.getProductByCode(code);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", requireAuth, requireAdmin, async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateProductSchema.parse(req.body);
      
      const existingProduct = await storage.getProduct(id);
      if (!existingProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      const product = await storage.updateProduct(id, validatedData);
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const existingProduct = await storage.getProduct(id);
      if (!existingProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      const deleted = await storage.deleteProduct(id);
      if (deleted) {
        res.json({ success: true, message: "Product deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete product" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  app.get("/api/cart", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;

      let cart = await storage.getCartByUserId(userId);

      if (!cart) {
        return res.json({ items: [] });
      }

      const items = await storage.getCartItems(cart.id);
      res.json({ cart, items });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  app.post("/api/cart", requireAuth, checkoutLimiter, async (req, res) => {
    try {
      const userId = req.user.id;
      const { productId, quantity } = req.body;

      let cart = await storage.getCartByUserId(userId);

      if (!cart) {
        cart = await storage.createCart({ userId });
      }

      const existingItems = await storage.getCartItems(cart.id);
      const existingItem = existingItems.find(item => item.productId === productId);

      if (existingItem) {
        await storage.updateCartItemQuantity(existingItem.id, existingItem.quantity + quantity);
      } else {
        await storage.addCartItem({ cartId: cart.id, productId, quantity });
      }

      await storage.updateCartTimestamp(cart.id);

      const items = await storage.getCartItems(cart.id);
      res.json({ cart, items });
    } catch (error) {
      res.status(500).json({ message: "Failed to add item to cart" });
    }
  });

  app.patch("/api/cart/item/:id", requireAuth, checkoutLimiter, async (req, res) => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      if (quantity <= 0) {
        await storage.removeCartItem(id);
      } else {
        await storage.updateCartItemQuantity(id, quantity);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  app.delete("/api/cart/item/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.removeCartItem(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove cart item" });
    }
  });

  app.post("/api/orders", requireAuth, checkoutLimiter, async (req, res) => {
    try {
      const userId = req.user.id;
      const { shipping, deliveryMethod, paymentMethod, promoCode, deliveryCharge, discount } = req.body;

      if (!shipping || !shipping.name || !shipping.phone || !shipping.address || !shipping.city || !shipping.state || !shipping.pinCode) {
        return res.status(400).json({ error: "Shipping information is required" });
      }

      const result = await db.transaction(async (tx) => {
        const [cart] = await tx.select().from(carts).where(eq(carts.userId, userId)).limit(1);
        if (!cart) {
          const err = new Error("Cart is empty");
          err.status = 400;
          throw err;
        }

        const lockedCartRows = await tx.execute(sql`
          SELECT
            ci.id,
            ci."productId",
            ci.quantity,
            p.name,
            p.price,
            p.stock
          FROM cart_items ci
          INNER JOIN products p ON p.id = ci."productId"
          WHERE ci."cartId" = ${cart.id}
          FOR UPDATE OF ci, p
        `);

        const cartRows = lockedCartRows.rows || [];
        if (cartRows.length === 0) {
          const err = new Error("Cart is empty");
          err.status = 400;
          throw err;
        }

        const mergedByProduct = new Map();
        for (const row of cartRows) {
          const productId = row.productId;
          const quantity = Number(row.quantity || 0);
          if (quantity <= 0) {
            const err = new Error(`Invalid quantity for product ${row.name}`);
            err.status = 400;
            throw err;
          }
          const existing = mergedByProduct.get(productId);
          if (existing) {
            existing.quantity += quantity;
          } else {
            mergedByProduct.set(productId, {
              productId,
              name: row.name,
              price: Number(row.price),
              stock: Number(row.stock),
              quantity,
            });
          }
        }

        const mergedItems = Array.from(mergedByProduct.values());
        const cartProductIds = mergedItems.map(item => item.productId);

        const existingProducts = await tx
          .select({ id: products.id })
          .from(products)
          .where(inArray(products.id, cartProductIds));

        const existingSet = new Set(existingProducts.map(p => p.id));
        for (const item of mergedItems) {
          if (!existingSet.has(item.productId)) {
            const err = new Error(`Product deleted for product ${item.name}`);
            err.status = 400;
            throw err;
          }
          if (item.stock < item.quantity) {
            const err = new Error(`Insufficient stock for product ${item.name}`);
            err.status = 400;
            throw err;
          }
        }

        const subtotal = mergedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const deliveryChargeAmount = parseFloat(deliveryCharge) || 0;
        const discountAmount = parseFloat(discount) || 0;
        const totalAmount = subtotal - discountAmount + deliveryChargeAmount;

        const [createdOrder] = await tx.insert(orders).values({
          id: randomUUID(),
          userId,
          totalAmount: totalAmount.toFixed(2),
          subtotal: subtotal.toFixed(2),
          deliveryCharge: deliveryChargeAmount.toFixed(2),
          discount: discountAmount.toFixed(2),
          promoCode: promoCode || null,
          deliveryMethod: deliveryMethod || 'standard',
          paymentMethod: paymentMethod || 'cod',
          status: "PENDING",
          paymentStatus: "PENDING",
          shippingName: shipping.name,
          shippingPhone: shipping.phone,
          shippingAddress: shipping.address,
          shippingCity: shipping.city,
          shippingState: shipping.state,
          shippingPinCode: shipping.pinCode
        }).returning();

        const insertedOrderItems = [];
        for (const item of mergedItems) {
          const [updatedProduct] = await tx
            .update(products)
            .set({ stock: sql`${products.stock} - ${item.quantity}` })
            .where(and(eq(products.id, item.productId), sql`${products.stock} >= ${item.quantity}`))
            .returning({ id: products.id });

          if (!updatedProduct) {
            const err = new Error(`Insufficient stock for product ${item.name}`);
            err.status = 400;
            throw err;
          }

          const [createdOrderItem] = await tx.insert(orderItems).values({
            id: randomUUID(),
            orderId: createdOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            priceAtPurchase: item.price.toFixed(2),
          }).returning();

          insertedOrderItems.push({
            ...createdOrderItem,
            product: {
              id: item.productId,
              name: item.name,
            },
          });
        }

        await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));

        return { order: createdOrder, items: insertedOrderItems };
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Checkout transaction failed:", error);

      if (error?.status === 400) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.get("/api/orders", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const orders = await storage.getOrdersByUserId(userId);

      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          return { ...order, items };
        })
      );

      res.json(ordersWithItems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role === "ADMIN";
      
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.userId !== userId && !isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const items = await storage.getOrderItems(order.id);
      res.json({ ...order, items });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.get("/api/admin/orders", requireAuth, requireAdmin, async (req, res) => {
    try {
      const ordersWithUsers = await storage.getAllOrders();
      
      const ordersWithItems = await Promise.all(
        ordersWithUsers.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          return {
            id: order.id,
            userId: order.userId,
            userName: order.user?.name || "Guest",
            userEmail: order.user?.email || "N/A",
            totalAmount: order.totalAmount,
            status: order.status,
            createdAt: order.createdAt,
            itemCount: items.length,
          };
        })
      );

      res.json(ordersWithItems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/admin/orders/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const items = await storage.getOrderItems(order.id);
      
      let user = null;
      if (order.userId) {
        const userData = await storage.getUser(order.userId);
        if (userData) {
          const { passwordHash, ...userWithoutPassword } = userData;
          user = userWithoutPassword;
        }
      }

      res.json({
        id: order.id,
        userId: order.userId,
        user,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt,
        items: items.map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.product.name,
          productCode: item.product.code,
          quantity: item.quantity,
          price: item.price,
        })),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.patch("/api/admin/orders/:id/status", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateOrderStatusSchema.parse(req.body);
      
      const existingOrder = await storage.getOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      const order = await storage.updateOrderStatus(id, validatedData.status);
      res.json({ id: order?.id, status: order?.status });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid status", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);

      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const existingName = await storage.getUserByName(validatedData.name);
      if (existingName) {
        return res.status(400).json({ message: "Name already taken" });
      }

      const user = await storage.createUser(validatedData);
      
      const { passwordHash, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const isValidPassword = await storage.verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = signToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      const { passwordHash, ...userWithoutPassword } = user;
      res.json({ token, user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ error: "Something went wrong" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { passwordHash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Something went wrong" });
    }
  });

  app.put("/api/users/me", requireAuth, async (req, res) => {
    try {
      const validatedData = updateUserProfileSchema.parse(req.body);
      const user = await storage.updateUserProfile(req.user.id, validatedData);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { passwordHash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ error: "Something went wrong" });
    }
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const validatedData = changePasswordSchema.parse(req.body);
      
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isValidPassword = await storage.verifyPassword(validatedData.currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      const newPasswordHash = await bcrypt.hash(validatedData.newPassword, 10);
      await storage.updateUserPassword(req.user.id, newPasswordHash);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ error: "Something went wrong" });
    }
  });

  app.get("/api/addresses", requireAuth, async (req, res) => {
    try {
      const addresses = await storage.getAddressesByUserId(req.user.id);
      res.json(addresses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch addresses" });
    }
  });

  app.post("/api/addresses", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAddressSchema.parse(req.body);
      const address = await storage.createAddress(req.user.id, validatedData);
      res.status(201).json(address);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid address data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create address" });
    }
  });

  app.put("/api/addresses/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const existingAddress = await storage.getAddress(id);
      
      if (!existingAddress) {
        return res.status(404).json({ error: "Address not found" });
      }

      if (existingAddress.userId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const validatedData = updateAddressSchema.parse(req.body);
      const address = await storage.updateAddress(id, validatedData);
      res.json(address);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid address data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update address" });
    }
  });

  app.delete("/api/addresses/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const existingAddress = await storage.getAddress(id);
      
      if (!existingAddress) {
        return res.status(404).json({ error: "Address not found" });
      }

      if (existingAddress.userId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.deleteAddress(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete address" });
    }
  });

  app.patch("/api/addresses/:id/default", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const existingAddress = await storage.getAddress(id);
      
      if (!existingAddress) {
        return res.status(404).json({ error: "Address not found" });
      }

      if (existingAddress.userId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const address = await storage.setDefaultAddress(req.user.id, id);
      res.json(address);
    } catch (error) {
      res.status(500).json({ message: "Failed to set default address" });
    }
  });

  app.get("/api/wishlist", requireAuth, async (req, res) => {
    try {
      const items = await storage.getWishlistByUserId(req.user.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  });

  app.post("/api/wishlist", requireAuth, async (req, res) => {
    try {
      const validatedData = insertWishlistItemSchema.parse(req.body);
      const item = await storage.addToWishlist(req.user.id, validatedData.productId);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add to wishlist" });
    }
  });

  app.delete("/api/wishlist/:productId", requireAuth, async (req, res) => {
    try {
      const { productId } = req.params;
      await storage.removeFromWishlist(req.user.id, productId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove from wishlist" });
    }
  });

  app.get("/api/wishlist/:productId/check", requireAuth, async (req, res) => {
    try {
      const { productId } = req.params;
      const inWishlist = await storage.isInWishlist(req.user.id, productId);
      res.json({ inWishlist });
    } catch (error) {
      res.status(500).json({ message: "Failed to check wishlist status" });
    }
  });

  app.get("/api/my/orders", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const orders = await storage.getOrdersByUserId(userId);

      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          return { ...order, items };
        })
      );

      res.json(ordersWithItems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/admin/overview", requireAuth, requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminOverviewStats();
      const salesTimeseries = await storage.getSalesTimeseries(30);
      const ordersByStatus = await storage.getOrdersByStatus();
      const topProducts = await storage.getTopProducts(10);
      const recentActivity = await storage.getRecentAuditLogs(8);

      res.json({
        stats,
        salesTimeseries,
        ordersByStatus,
        topProducts,
        recentActivity,
      });
    } catch (error) {
      console.error("Admin overview error:", error);
      res.status(500).json({ message: "Failed to fetch overview data" });
    }
  });

  app.get("/api/admin/top-products", requireAuth, requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const topProducts = await storage.getTopProducts(limit);
      res.json(topProducts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch top products" });
    }
  });

  app.get("/api/admin/recent-activity", requireAuth, requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const activity = await storage.getRecentAuditLogs(limit);
      res.json(activity);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  app.get("/api/admin/products", requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await storage.getAdminProductsPaginated(req.query);
      res.json(result);
    } catch (error) {
      console.error("Admin products error:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/admin/products/categories", requireAuth, requireAdmin, async (req, res) => {
    try {
      const categories = await storage.getProductCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/admin/products/bulk", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { ids, action, data } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No products selected" });
      }

      let updateData = {};
      if (action === 'activate') updateData.active = true;
      else if (action === 'deactivate') updateData.active = false;
      else if (action === 'adjustStock' && data?.adjustment) {
        const results = [];
        for (const id of ids) {
          const updated = await storage.adjustProductStock(id, data.adjustment);
          if (updated) results.push(updated);
        }
        await createAuditLog(storage, req, 'BULK_STOCK_ADJUST', 'products', ids.join(','), { adjustment: data.adjustment });
        return res.json({ updated: results.length, products: results });
      }

      if (Object.keys(updateData).length > 0) {
        const results = await storage.bulkUpdateProducts(ids, updateData);
        await createAuditLog(storage, req, `BULK_${action.toUpperCase()}`, 'products', ids.join(','), updateData);
        return res.json({ updated: results.length, products: results });
      }

      res.status(400).json({ message: "Invalid action" });
    } catch (error) {
      res.status(500).json({ message: "Bulk operation failed" });
    }
  });

  app.post("/api/admin/products/import", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { products: productsData } = req.body;
      if (!productsData || !Array.isArray(productsData)) {
        return res.status(400).json({ message: "Invalid products data" });
      }

      const results = await storage.bulkImportProducts(productsData);
      await createAuditLog(storage, req, 'PRODUCTS_IMPORT', 'products', null, results);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Import failed" });
    }
  });

  app.get("/api/admin/products/export", requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await storage.getAdminProductsPaginated({ ...req.query, pageSize: 10000 });
      const csv = [
        'name,code,price,stock,category,imageUrl,description,active',
        ...result.items.map(p => 
          `"${p.name}","${p.code}",${p.price},${p.stock},"${p.category}","${p.imageUrl}","${p.description || ''}",${p.active}`
        )
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Export failed" });
    }
  });

  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await storage.getUsersWithPagination(req.query);
      res.json(result);
    } catch (error) {
      console.error("Admin users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { passwordHash, ...userWithoutPassword } = user;
      const ordersSummary = await storage.getUserOrdersSummary(id);
      res.json({ ...userWithoutPassword, ordersSummary });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch("/api/admin/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateUserRoleSchema.parse(req.body);
      
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = await storage.updateUserRole(id, validatedData.role);
      await createAuditLog(storage, req, 'USER_ROLE_CHANGE', 'user', id, { oldRole: existingUser.role, newRole: validatedData.role });
      
      const { passwordHash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid role", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.patch("/api/admin/users/:id/active", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateUserActiveSchema.parse(req.body);
      
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = await storage.updateUserActive(id, validatedData.active);
      await createAuditLog(storage, req, validatedData.active ? 'USER_ENABLED' : 'USER_DISABLED', 'user', id, {});
      
      const { passwordHash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  app.post("/api/admin/users/:id/revoke-sessions", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      await createAuditLog(storage, req, 'USER_SESSIONS_REVOKED', 'user', id, {});
      res.json({ success: true, message: "Sessions revoked" });
    } catch (error) {
      res.status(500).json({ message: "Failed to revoke sessions" });
    }
  });

  app.get("/api/admin/inventory/low-stock", requireAuth, requireAdmin, async (req, res) => {
    try {
      const threshold = parseInt(req.query.threshold) || 10;
      const products = await storage.getLowStockProducts(threshold);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch low stock products" });
    }
  });

  app.post("/api/admin/products/:id/adjust-stock", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { adjustment } = req.body;
      
      if (typeof adjustment !== 'number') {
        return res.status(400).json({ message: "Invalid adjustment value" });
      }

      const product = await storage.adjustProductStock(id, adjustment);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      await createAuditLog(storage, req, 'STOCK_ADJUSTED', 'product', id, { adjustment, newStock: product.stock });
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to adjust stock" });
    }
  });

  app.post("/api/admin/orders/:id/notes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { note } = req.body;
      
      if (!note || typeof note !== 'string') {
        return res.status(400).json({ message: "Note is required" });
      }

      const existingOrder = await storage.getOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      const orderNote = await storage.createOrderNote(id, req.user.id, note);
      await createAuditLog(storage, req, 'ORDER_NOTE_ADDED', 'order', id, { note });
      res.status(201).json(orderNote);
    } catch (error) {
      res.status(500).json({ message: "Failed to add note" });
    }
  });

  app.get("/api/admin/orders/:id/notes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const notes = await storage.getOrderNotes(id);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.get("/api/admin/orders/export", requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await storage.getAdminOrdersPaginated({ ...req.query, pageSize: 10000 });
      const csv = [
        'id,customerName,customerEmail,total,status,paymentStatus,shippingAddress,createdAt',
        ...result.items.map(o => 
          `"${o.id}","${o.user?.name || o.shippingName}","${o.user?.email || ''}",${o.totalAmount},"${o.status}","${o.paymentStatus}","${o.shippingAddress}, ${o.shippingCity}","${o.createdAt}"`
        )
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Export failed" });
    }
  });

  app.get("/api/admin/audit-logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await storage.getAuditLogs(req.query);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllAdminSettings();
      res.json({
        freeShippingThreshold: settings.freeShippingThreshold || '50',
        lowStockThreshold: settings.lowStockThreshold || '10',
        maintenanceMode: settings.maintenanceMode || 'false',
        currency: settings.currency || 'INR',
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/public", async (req, res) => {
    try {
      const settings = await storage.getAllAdminSettings();
      res.json({
        currency: settings.currency || 'INR',
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ message: "Key and value required" });
      }

      const allowedKeys = ['freeShippingThreshold', 'lowStockThreshold', 'maintenanceMode', 'currency'];
      if (!allowedKeys.includes(key)) {
        return res.status(400).json({ message: "Invalid setting key" });
      }

      if (key === 'currency' && !['INR', 'USD', 'AED'].includes(value)) {
        return res.status(400).json({ message: "Invalid currency. Allowed: INR, USD, AED" });
      }

      await storage.setAdminSetting(key, String(value));
      await createAuditLog(storage, req, 'SETTING_CHANGED', 'settings', key, { value });
      res.json({ success: true, key, value });
    } catch (error) {
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  app.post("/api/contact", contactLimiter, async (req, res) => {
    try {
      const phone2 = req.body.phone2;
      if (phone2) {
        return res.status(400).json({ message: "Invalid submission" });
      }

      const validatedData = insertContactSubmissionSchema.parse(req.body);
      const submission = await storage.createContactSubmission(validatedData);
      res.status(201).json({ 
        success: true, 
        ticketNumber: submission.ticketNumber,
        message: "Your message has been received. We'll get back to you soon."
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Contact submission error:", error);
      res.status(500).json({ message: "Failed to submit contact form" });
    }
  });

  app.post("/api/subscribe", async (req, res) => {
    try {
      const validatedData = insertNewsletterSubscriberSchema.parse(req.body);
      const result = await storage.subscribeNewsletter(validatedData.email);
      
      if (result.alreadySubscribed) {
        return res.json({ success: true, message: "You're already subscribed!" });
      }
      
      res.status(201).json({ success: true, message: "Thanks for subscribing!" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email", errors: error.errors });
      }
      console.error("Newsletter subscription error:", error);
      res.status(500).json({ message: "Failed to subscribe" });
    }
  });

  return httpServer;
}
