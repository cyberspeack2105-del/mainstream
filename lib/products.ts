import { ObjectId } from 'mongodb';
import type { Product } from '@/types';

export type ProductInput = Pick<
  Product,
  | 'name'
  | 'sku'
  | 'category'
  | 'brand'
  | 'purchasePrice'
  | 'sellingPrice'
  | 'mrp'
  | 'gstRate'
  | 'hsnCode'
  | 'stock'
  | 'minStock'
> &
  Pick<Product, 'barcode' | 'warranty'>;

export type ProductRecord = {
  _id: ObjectId;
  productName: string;
  productCode: string;
  category: string;
  brand: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  gstRate: number;
  hsnCode: string;
  currentStock: number;
  minimumStock: number;
  barcode?: string;
  warranty?: string;
  isActive: boolean;
};

const requiredStrings = ['name', 'sku', 'category', 'brand', 'hsnCode'] as const;
const optionalStrings = ['barcode', 'warranty'] as const;
const numericFields = [
  'purchasePrice',
  'sellingPrice',
  'mrp',
  'gstRate',
  'stock',
  'minStock',
] as const;
const stringLimits: Record<(typeof requiredStrings)[number] | (typeof optionalStrings)[number], number> = {
  name: 160,
  sku: 64,
  category: 80,
  brand: 80,
  hsnCode: 16,
  barcode: 80,
  warranty: 120,
};

export function validateProductInput(value: unknown): value is ProductInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return (
    requiredStrings.every((key) => {
      const field = input[key];
      return (
        typeof field === 'string' &&
        field.trim().length > 0 &&
        field.trim().length <= stringLimits[key]
      );
    }) &&
    optionalStrings.every((key) => {
      const field = input[key];
      return field === undefined || (
        typeof field === 'string' && field.trim().length <= stringLimits[key]
      );
    }) &&
    numericFields.every(
      (key) =>
        typeof input[key] === 'number' &&
        Number.isFinite(input[key]) &&
        input[key] >= 0
    ) &&
    Number.isInteger(input.stock) &&
    Number.isInteger(input.minStock) &&
    Number(input.gstRate) <= 100
  );
}

export function toProductDocument(input: ProductInput) {
  return {
    productName: input.name.trim(),
    productCode: input.sku.trim().toUpperCase(),
    category: input.category.trim(),
    brand: input.brand.trim(),
    purchasePrice: input.purchasePrice,
    sellingPrice: input.sellingPrice,
    mrp: input.mrp,
    gstRate: input.gstRate,
    hsnCode: input.hsnCode.trim(),
    currentStock: input.stock,
    minimumStock: input.minStock,
    barcode: input.barcode?.trim() ?? '',
    warranty: input.warranty?.trim() ?? '',
  };
}

export function toClientProduct(product: ProductRecord): Product {
  return {
    id: product._id.toHexString(),
    name: product.productName,
    sku: product.productCode,
    category: product.category,
    brand: product.brand,
    purchasePrice: product.purchasePrice,
    sellingPrice: product.sellingPrice,
    mrp: product.mrp,
    discountPercentage:
      product.mrp > 0
        ? Math.max(0, Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100))
        : 0,
    gstRate: product.gstRate,
    hsnCode: product.hsnCode,
    stock: product.currentStock,
    minStock: product.minimumStock,
    inStock: product.currentStock > 0,
    barcode: product.barcode ?? '',
    warranty: product.warranty ?? '',
  };
}
