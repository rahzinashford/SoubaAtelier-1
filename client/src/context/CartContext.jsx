import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getErrorMessage, parseJsonSafely } from '@/lib/apiError';

const CartContext = createContext(null);

const API_BASE = '/api';

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getHeaders = useCallback(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setCartItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/cart`, {
        headers: getHeaders(),
      });

      const data = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Failed to fetch cart'));
      }

      const items = ((data?.items) || []).map(item => ({
        id: item.id,
        productId: item.productId,
        code: item.product?.code || '',
        name: item.product?.name || '',
        price: parseFloat(item.product?.price || 0),
        quantity: item.quantity,
        imageUrl: item.product?.imageUrl || '',
        product: item.product,
      }));
      
      setCartItems(items);
    } catch (err) {
      console.error('Error fetching cart:', err);
      setError(err.message);
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, getHeaders]);

  useEffect(() => {
    if (!authLoading) {
      fetchCart();
    }
  }, [authLoading, isAuthenticated, fetchCart]);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const addItem = useCallback(async (product, quantity = 1) => {
    if (!product || !product.id) {
      throw new Error('Invalid product passed to addItem');
    }

    if (!isAuthenticated) {
      setError('Please login to add items to cart');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/cart`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          productId: product.id,
          quantity,
        }),
      });

      if (!response.ok) {
        const errorData = await parseJsonSafely(response);
        throw new Error(getErrorMessage(errorData, 'Failed to add item to cart'));
      }

      await fetchCart();
      return true;
    } catch (err) {
      console.error('Error adding to cart:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, getHeaders, fetchCart]);

  const updateQuantity = useCallback(async (cartItemId, change) => {
    if (!isAuthenticated) return false;

    const item = cartItems.find(i => i.id === cartItemId);
    if (!item) return false;

    const newQuantity = item.quantity + change;
    if (newQuantity < 1) return false;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/cart/item/${cartItemId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ quantity: newQuantity }),
      });

      if (!response.ok) {
        const errorData = await parseJsonSafely(response);
        throw new Error(getErrorMessage(errorData, 'Failed to update quantity'));
      }

      await fetchCart();
      return true;
    } catch (err) {
      console.error('Error updating quantity:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, cartItems, getHeaders, fetchCart]);

  const removeItem = useCallback(async (cartItemId) => {
    if (!isAuthenticated) return false;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/cart/item/${cartItemId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!response.ok) {
        const errorData = await parseJsonSafely(response);
        throw new Error(getErrorMessage(errorData, 'Failed to remove item'));
      }

      await fetchCart();
      return true;
    } catch (err) {
      console.error('Error removing item:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, getHeaders, fetchCart]);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const value = {
    cartItems,
    cartCount,
    subtotal,
    loading,
    error,
    updateQuantity,
    removeItem,
    addItem,
    clearCart,
    fetchCart,
    isAuthenticated,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export default CartContext;
