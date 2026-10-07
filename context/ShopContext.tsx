'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Product } from '@/types';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ShopContextType {
  products: Product[];
  productsLoading: boolean;
  productsError: string;
  toasts: ToastMessage[];
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  showToast: (message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
  reloadProducts: () => Promise<void>;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const showToast = (message: string, type: ToastMessage['type'] = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => removeToast(id), 4000);
  };

  const reloadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError('');
    try {
      const response = await fetch('/api/products', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load products');
      setProducts(result as Product[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load products';
      setProducts([]);
      setProductsError(message);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pathname === '/login') return;
    const timeout = window.setTimeout(() => void reloadProducts(), 0);
    return () => window.clearTimeout(timeout);
  }, [pathname, reloadProducts]);

  const addProduct = async (product: Omit<Product, 'id'>) => {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to add product');
    setProducts((current) => [result as Product, ...current]);
    showToast('Product added', 'success');
  };

  const updateProduct = async (id: string, product: Partial<Product>) => {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to update product');
    setProducts((current) => current.map((item) => (item.id === id ? result as Product : item)));
    showToast('Product updated', 'success');
  };

  const deleteProduct = async (id: string) => {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to deactivate product');
    setProducts((current) => current.filter((product) => product.id !== id));
    showToast('Product deactivated', 'info');
  };

  return (
    <ShopContext.Provider
      value={{
        products,
        productsLoading,
        productsError,
        toasts,
        addProduct,
        updateProduct,
        deleteProduct,
        showToast,
        removeToast,
        reloadProducts,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop must be used within a ShopProvider');
  return context;
}
