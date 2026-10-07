import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'outline';
  className?: string;
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  const variantStyles = {
    primary: 'bg-blue-50 text-blue-700 border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    outline: 'bg-transparent text-slate-600 border-slate-300',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  let variant: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';

  switch (status) {
    case 'Paid':
    case 'Completed':
    case 'Ready':
    case 'Active':
      variant = 'success';
      break;
    case 'Partially Paid':
    case 'Processing':
    case 'Confirmed':
      variant = 'primary';
      break;
    case 'Pending Verification':
    case 'Order Placed':
    case 'Low Stock':
      variant = 'warning';
      break;
    case 'Credit / Due':
    case 'Cancelled':
    case 'Out of Stock':
    case 'Inactive':
      variant = 'danger';
      break;
    default:
      variant = 'neutral';
  }

  return <Badge variant={variant}>{status}</Badge>;
}
