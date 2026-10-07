import ExcelJS from 'exceljs';
import { NextRequest, NextResponse } from 'next/server';
import { requireProductManager } from '@/lib/auth/authorization';
import { PRODUCT_IMPORT_HEADERS } from '@/lib/product-import';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireProductManager(request);
    if (user instanceof NextResponse) return user;

    const workbook = new ExcelJS.Workbook();
    const products = workbook.addWorksheet('Products');
    products.addRow([...PRODUCT_IMPORT_HEADERS]);
    products.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    products.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
    products.columns = [
      { width: 28 }, { width: 20 }, { width: 18 }, { width: 18 },
      { width: 16 }, { width: 16 }, { width: 14 }, { width: 12 },
      { width: 16 }, { width: 12 }, { width: 18 }, { width: 20 }, { width: 18 },
    ];
    products.views = [{ state: 'frozen', ySplit: 1 }];

    const instructions = workbook.addWorksheet('Instructions');
    instructions.addRows([
      ['Product upload template'],
      ['Add one product per row in the Products sheet. Do not rename the required headers.'],
      ['Required: Product Name, Product Code, Category, Brand, Purchase Price, Selling Price, MRP, GST Rate, HSN Code, Stock, Minimum Stock.'],
      ['Optional: Barcode, Warranty.'],
      ['Product Code must be unique. Keep codes as text to preserve leading zeroes.'],
      ['Prices and stock must be non-negative numbers. Stock and Minimum Stock must be whole numbers. GST Rate cannot exceed 100.'],
      ['Maximum: 500 product rows; maximum workbook size: 5 MB.'],
    ]);
    instructions.getColumn(1).width = 110;
    instructions.getRow(1).font = { bold: true, size: 14 };

    const file = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="main-stream-products-template.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Failed to create product import template:', error);
    return NextResponse.json({ error: 'Unable to create the product template.' }, { status: 503 });
  }
}
