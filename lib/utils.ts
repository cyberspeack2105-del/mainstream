import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function calculateGST(amount: number, rate: number = 18, isInterState: boolean = false) {
  // Amount is base taxable value
  const gstTotal = (amount * rate) / 100;
  if (isInterState) {
    return {
      cgst: 0,
      sgst: 0,
      igst: gstTotal,
      totalGst: gstTotal,
      grandTotal: amount + gstTotal,
    };
  }
  return {
    cgst: gstTotal / 2,
    sgst: gstTotal / 2,
    igst: 0,
    totalGst: gstTotal,
    grandTotal: amount + gstTotal,
  };
}

export function getDiscountPercentage(mrp: number, sellingPrice: number): number {
  if (!mrp || mrp <= sellingPrice) return 0;
  return Math.round(((mrp - sellingPrice) / mrp) * 100);
}
