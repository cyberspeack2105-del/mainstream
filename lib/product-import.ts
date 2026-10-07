import ExcelJS from 'exceljs';
import { validateProductInput, type ProductInput } from '@/lib/products';

export const PRODUCT_IMPORT_HEADERS = [
  'Product Name',
  'Product Code',
  'Category',
  'Brand',
  'Purchase Price',
  'Selling Price',
  'MRP',
  'GST Rate',
  'HSN Code',
  'Stock',
  'Minimum Stock',
  'Barcode',
  'Warranty',
] as const;

const requiredHeaders = PRODUCT_IMPORT_HEADERS.slice(0, 11);
const headerAliases: Record<string, string> = {
  productname: 'Product Name',
  name: 'Product Name',
  productcode: 'Product Code',
  code: 'Product Code',
  sku: 'Product Code',
  category: 'Category',
  brand: 'Brand',
  purchaseprice: 'Purchase Price',
  sellingprice: 'Selling Price',
  mrp: 'MRP',
  gstrate: 'GST Rate',
  gst: 'GST Rate',
  hsncode: 'HSN Code',
  hsn: 'HSN Code',
  stock: 'Stock',
  minimumstock: 'Minimum Stock',
  minstock: 'Minimum Stock',
  barcode: 'Barcode',
  warranty: 'Warranty',
};

export type ProductImportError = {
  row: number;
  productCode: string;
  reasons: string[];
};

export type ParsedProductImport = {
  products: ProductInput[];
  productRows: number[];
  errors: ProductImportError[];
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cellText(cell: ExcelJS.Cell): string {
  if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Hyperlink) {
    return '';
  }
  return cell.text.trim();
}

function cellNumber(cell: ExcelJS.Cell): number {
  if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Hyperlink) {
    return Number.NaN;
  }
  const value = cell.value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value.trim());
  return Number.NaN;
}

export async function parseProductWorkbook(buffer: Buffer): Promise<ParsedProductImport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('The workbook does not contain a worksheet.');
  if (worksheet.rowCount > 501) {
    throw new Error('A spreadsheet can contain at most 500 product rows.');
  }

  const headerRow = worksheet.getRow(1);
  const headerColumns = new Map<string, number>();
  const duplicateHeaders = new Set<string>();
  headerRow.eachCell((cell, column) => {
    const canonical = headerAliases[normalizeHeader(cellText(cell))];
    if (canonical) {
      if (headerColumns.has(canonical)) duplicateHeaders.add(canonical);
      else headerColumns.set(canonical, column);
    }
  });
  if (duplicateHeaders.size) {
    throw new Error(`Duplicate columns: ${[...duplicateHeaders].join(', ')}.`);
  }
  const missingHeaders = requiredHeaders.filter((header) => !headerColumns.has(header));
  if (missingHeaders.length) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}.`);
  }

  const products: ProductInput[] = [];
  const productRows: number[] = [];
  const errors: ProductImportError[] = [];
  const seenCodes = new Map<string, number>();
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values = headerColumns;
    const rawName = cellText(row.getCell(values.get('Product Name')!));
    const rawCode = cellText(row.getCell(values.get('Product Code')!));
    if (!rawName && !rawCode && row.cellCount === 0) continue;
    if (!rawName && !rawCode && !row.hasValues) continue;

    const text = (header: string) => {
      const column = values.get(header);
      return column ? cellText(row.getCell(column)) : '';
    };
    const number = (header: string) => {
      const column = values.get(header);
      return column ? cellNumber(row.getCell(column)) : Number.NaN;
    };
    const product: ProductInput = {
      name: rawName,
      sku: rawCode,
      category: text('Category'),
      brand: text('Brand'),
      purchasePrice: number('Purchase Price'),
      sellingPrice: number('Selling Price'),
      mrp: number('MRP'),
      gstRate: number('GST Rate'),
      hsnCode: text('HSN Code'),
      stock: number('Stock'),
      minStock: number('Minimum Stock'),
      barcode: text('Barcode'),
      warranty: text('Warranty'),
    };
    const reasons: string[] = [];
    if (!validateProductInput(product)) {
      reasons.push('Required text fields, non-negative numeric values, GST rate, or whole-number stock are invalid.');
    }
    const normalizedCode = rawCode.trim().toUpperCase();
    if (normalizedCode) {
      const previousRow = seenCodes.get(normalizedCode);
      if (previousRow) reasons.push(`Product code duplicates spreadsheet row ${previousRow}.`);
      else seenCodes.set(normalizedCode, rowNumber);
    }
    if (reasons.length) errors.push({ row: rowNumber, productCode: rawCode, reasons });
    else {
      products.push(product);
      productRows.push(rowNumber);
    }
  }

  if (!products.length && !errors.length) {
    throw new Error('The worksheet does not contain any product rows.');
  }
  return { products, productRows, errors };
}
