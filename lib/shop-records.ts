export type ShopRecordKind = 'customers' | 'suppliers';

type ShopRecordFieldDefinition = {
  key: string;
  label: string;
  required?: boolean;
};

export const SHOP_RECORD_FIELDS = {
  customers: [
    { key: 'name', label: 'Customer name', required: true },
    { key: 'phone', label: 'Phone', required: true },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'pincode', label: 'PIN code' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'notes', label: 'Notes' },
  ],
  suppliers: [
    { key: 'name', label: 'Supplier name', required: true },
    { key: 'contactPerson', label: 'Contact person' },
    { key: 'phone', label: 'Phone', required: true },
    { key: 'email', label: 'Email' },
    { key: 'city', label: 'City' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'address', label: 'Address' },
    { key: 'notes', label: 'Notes' },
  ],
} satisfies Record<ShopRecordKind, readonly ShopRecordFieldDefinition[]>;

export type ShopRecordField = (typeof SHOP_RECORD_FIELDS)[ShopRecordKind][number]['key'];

export type ShopRecordDocument = {
  _id: import('mongodb').ObjectId;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  contactPerson?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function normalizeShopRecord(kind: ShopRecordKind, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Enter a valid record.' } as const;
  }
  const values = input as Record<string, unknown>;
  const fields = SHOP_RECORD_FIELDS[kind];
  const output: Record<string, string> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (field.required && (typeof value !== 'string' || !value.trim())) {
      return { error: `${field.label} is required.` } as const;
    }
    if (value !== undefined && typeof value !== 'string') {
      return { error: `${field.label} must be text.` } as const;
    }
    const text = typeof value === 'string' ? value.trim() : '';
    const limit = field.key === 'notes' || field.key === 'address' ? 1000 : 180;
    if (text.length > limit) return { error: `${field.label} is too long.` } as const;
    if (text) output[field.key] = text;
  }
  if (output.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(output.email)) {
    return { error: 'Enter a valid email address.' } as const;
  }
  if (!/^[+\d()\-\s]{7,24}$/.test(output.phone ?? '')) {
    return { error: 'Enter a valid phone number.' } as const;
  }
  if (kind === 'customers' && output.pincode && !/^\d{5,10}$/.test(output.pincode)) {
    return { error: 'PIN code must contain 5 to 10 digits.' } as const;
  }
  if (output.gstin && !/^[0-9A-Z]{15}$/i.test(output.gstin)) {
    return { error: 'GSTIN must contain 15 letters or digits.' } as const;
  }
  return { value: output } as const;
}
