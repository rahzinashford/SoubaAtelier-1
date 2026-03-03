import { safeStorage } from './safeStorage';
import { getErrorMessage, parseJsonSafely } from './apiError';

const API_BASE = '/api';

function getAuthToken() {
  return safeStorage.getItem('authToken');
}

function getSessionId() {
  let sessionId = safeStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    safeStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
}

async function fetchAPI(endpoint, options) {
  const headers = {
    ...options?.headers,
  };

  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(data));
  }

  return data;
}

async function fetchAPIAuth(endpoint, options) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }
  return fetchAPI(endpoint, options);
}

export const productsAPI = {
  getAll: async () => {
    const data = await fetchAPI('/products');

    return data.map(p => ({
      ...p,
      price: Number(p.price),
    }));
  },


  getByCode: async (code) => {
    const p = await fetchAPI(`/products/code/${code}`);
    return { ...p, price: Number(p.price) };
  },

  search: (query) =>
    fetchAPI(`/products/search?q=${encodeURIComponent(query)}`),

  getByCategory: async (category) => {
    const data = await fetchAPI(`/products/category/${encodeURIComponent(category)}`);
    return data.map(p => ({
      ...p,
      price: Number(p.price),
    }));
  },
};


export const cartAPI = {
  get: () => fetchAPIAuth('/cart'),
  add: (data) => fetchAPIAuth('/cart', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateItem: (itemId, quantity) => fetchAPIAuth(`/cart/item/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  }),
  removeItem: (itemId) => fetchAPIAuth(`/cart/item/${itemId}`, {
    method: 'DELETE',
  }),
};

export const ordersAPI = {
  create: (data) => fetchAPIAuth('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getMyOrders: () => fetchAPIAuth('/orders'),
  getById: (id) => fetchAPIAuth(`/orders/${id}`),
};

export const authAPI = {
  register: (data) =>
    fetchAPI('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  login: (data) =>
    fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  me: () => fetchAPIAuth('/auth/me'),
  changePassword: (data) =>
    fetchAPIAuth('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const userAPI = {
  updateProfile: (data) =>
    fetchAPIAuth('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

export const addressesAPI = {
  getAll: () => fetchAPIAuth('/addresses'),
  create: (data) =>
    fetchAPIAuth('/addresses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    fetchAPIAuth(`/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    fetchAPIAuth(`/addresses/${id}`, {
      method: 'DELETE',
    }),
  setDefault: (id) =>
    fetchAPIAuth(`/addresses/${id}/default`, {
      method: 'PATCH',
    }),
};

export const wishlistAPI = {
  getAll: () => fetchAPIAuth('/wishlist'),
  add: (productId) =>
    fetchAPIAuth('/wishlist', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    }),
  remove: (productId) =>
    fetchAPIAuth(`/wishlist/${productId}`, {
      method: 'DELETE',
    }),
  check: (productId) => fetchAPIAuth(`/wishlist/${productId}/check`),
};

  export const adminAPI = {
  getOverview: () => fetchAPIAuth('/admin/overview'),
  getTopProducts: (limit = 10) => fetchAPIAuth(`/admin/top-products?limit=${limit}`),
  getRecentActivity: (limit = 20) => fetchAPIAuth(`/admin/recent-activity?limit=${limit}`),

  getProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPIAuth(`/admin/products${query ? `?${query}` : ''}`);
  },
  getProductCategories: () => fetchAPIAuth('/admin/products/categories'),
  createProduct: (data) =>
    fetchAPIAuth('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProduct: (id, data) =>
    fetchAPIAuth(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  uploadImages: (formData) => {
    return fetchAPIAuth('/admin/uploads/images', {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type for FormData
    });
  },
  deleteProduct: (id) =>
    fetchAPIAuth(`/products/${id}`, {
      method: 'DELETE',
    }),
  bulkProductAction: (ids, action, data) =>
    fetchAPIAuth('/admin/products/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids, action, data }),
    }),
  importProducts: (products) =>
    fetchAPIAuth('/admin/products/import', {
      method: 'POST',
      body: JSON.stringify({ products }),
    }),
  exportProductsUrl: () => '/api/admin/products/export',
  adjustStock: (id, adjustment) =>
    fetchAPIAuth(`/admin/products/${id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify({ adjustment }),
    }),

  getOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPIAuth(`/admin/orders${query ? `?${query}` : ''}`);
  },
  getOrderById: (id) => fetchAPIAuth(`/admin/orders/${id}`),
  updateOrderStatus: (id, status) =>
    fetchAPIAuth(`/admin/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getOrderNotes: (id) => fetchAPIAuth(`/admin/orders/${id}/notes`),
  addOrderNote: (id, note) =>
    fetchAPIAuth(`/admin/orders/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  exportOrdersUrl: () => '/api/admin/orders/export',

  getUsers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPIAuth(`/admin/users${query ? `?${query}` : ''}`);
  },
  getUserById: (id) => fetchAPIAuth(`/admin/users/${id}`),
  updateUserRole: (id, role) =>
    fetchAPIAuth(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  updateUserActive: (id, active) =>
    fetchAPIAuth(`/admin/users/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),
  revokeUserSessions: (id) =>
    fetchAPIAuth(`/admin/users/${id}/revoke-sessions`, {
      method: 'POST',
    }),

  getLowStock: (threshold = 10) =>
    fetchAPIAuth(`/admin/inventory/low-stock?threshold=${threshold}`),

  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPIAuth(`/admin/audit-logs${query ? `?${query}` : ''}`);
  },

  getSettings: () => fetchAPIAuth('/admin/settings'),
  updateSetting: (key, value) =>
    fetchAPIAuth('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ key, value }),
    }),
};

export { getSessionId };
