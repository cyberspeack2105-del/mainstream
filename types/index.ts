export interface Product {
  id: string;
  name: string;
  brand: string;
  sku: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  discountPercentage: number;
  hsnCode: string;
  gstRate: number;
  stock: number;
  minStock: number;
  inStock: boolean;
  barcode?: string;
  warranty?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  imageUrl: string;
  iconName: string;
  description: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin?: string;
  totalPurchases: number;
  totalPaid: number;
  outstandingBalance: number;
  ordersCount: number;
  lastOrderDate: string;
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  gstin: string;
  totalPurchases: number;
  paidAmount: number;
  outstandingBalance: number;
  categoriesSupplied: string[];
}

export type OrderStatus = 'Order Placed' | 'Confirmed' | 'Processing' | 'Ready' | 'Completed' | 'Cancelled';
export type PaymentStatus = 'Paid' | 'Partially Paid' | 'Credit / Due' | 'Pending Verification';

export interface PaymentTimelineEntry {
  id: string;
  date: string;
  amount: number;
  method: 'UPI / QR' | 'GPay / QR' | 'Cash';
  utr?: string;
  notes?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  mrp: number;
  hsnCode: string;
  gstRate: number;
  total: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress: string;
  customerGstin?: string;
  date: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentHistory: PaymentTimelineEntry[];
  paymentProofUrl?: string;
  notes?: string;
  source: 'Online Shop' | 'POS Counter' | 'WhatsApp';
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  purchasePrice: number;
  gstRate: number;
  total: number;
}

export interface PurchaseRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  date: string;
  items: PurchaseItem[];
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'Received' | 'Pending';
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  type: 'Add' | 'Damage / Return' | 'Correction';
  quantity: number;
  reason: string;
  date: string;
  adjustedBy: string;
}

export interface AIMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  recommendedProducts?: Product[];
  actionButtons?: { label: string; action: string; payload?: unknown }[];
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Owner' | 'Manager' | 'Cashier';
  status: 'Active' | 'Inactive';
  lastLogin: string;
  permissions: string[];
}
