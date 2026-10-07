import { notFound } from 'next/navigation';
import {
  BarChart3,
  Bot,
  Boxes,
  CreditCard,
  Settings,
  Truck,
  Users,
} from 'lucide-react';
import ModulePreview from '@/components/shop/ModulePreview';
import PurchaseStockPage from '@/components/shop/PurchaseStockPage';
import ShopSettingsPage from '@/components/shop/ShopSettingsPage';
import AiAssistantPage from '@/components/shop/AiAssistantPage';
import ReportsPage from '@/components/shop/ReportsPage';
import DuePage from '@/components/shop/DuePage';
import TallyPage from '@/components/shop/TallyPage';

const sections = {
  purchases: {
    title: 'Purchase',
    description: 'Supplier purchases and purchase records will be managed here.',
    icon: Truck,
  },
  stock: {
    title: 'Stock',
    description: 'Inventory levels and stock adjustments will be managed here.',
    icon: Boxes,
  },
  customers: {
    title: 'Customers',
    description: 'Shop customer records and contact details will appear here.',
    icon: Users,
  },
  due: {
    title: 'Due',
    description: 'Customer balances and due-payment records will be shown here.',
    icon: CreditCard,
  },
  reports: {
    title: 'Reports',
    description: 'Sales, inventory and finance report layouts will be added here.',
    icon: BarChart3,
  },
  settings: {
    title: 'Settings',
    description: 'Shop profile and application preferences will be configured here.',
    icon: Settings,
  },
  ai: {
    title: 'AI Assistant',
    description: 'Business insights and conversational assistance are planned for a later phase.',
    icon: Bot,
  },
} as const;

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: sectionName } = await params;
  if (sectionName === 'purchases' || sectionName === 'stock') {
    return <PurchaseStockPage mode={sectionName} />;
  }
  if (sectionName === 'settings') return <ShopSettingsPage />;
  if (sectionName === 'ai') return <AiAssistantPage />;
  if (sectionName === 'reports') return <ReportsPage />;
  if (sectionName === 'due') return <DuePage />;
  if (sectionName === 'tally') return <TallyPage />;
  const section = sections[sectionName as keyof typeof sections];
  if (!section) notFound();

  return <ModulePreview {...section} />;
}
