import { NextRequest, NextResponse } from 'next/server';
import { ObjectId, type ClientSession } from 'mongodb';
import { connectDatabase } from '@/lib/db/mongodb';
import { requireProductManager } from '@/lib/auth/authorization';
import { parseProductWorkbook } from '@/lib/product-import';
import {
  toProductDocument,
  validateProductInput,
  type ProductInput,
} from '@/lib/products';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 128 * 1024;
const MAX_PRODUCTS = 500;

export async function POST(request: NextRequest) {
  try {
    const user = await requireProductManager(request);
    if (user instanceof NextResponse) return user;

    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const contentLength = Number(request.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
        return NextResponse.json({ error: 'Spreadsheet upload request exceeds the 5 MB file limit.' }, { status: 413 });
      }
      const formData = await request.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Choose an .xlsx spreadsheet to upload.' }, { status: 400 });
      }
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        return NextResponse.json({ error: 'Only .xlsx Excel workbooks are supported.' }, { status: 400 });
      }
      if (!file.size || file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'Spreadsheet must be between 1 byte and 5 MB.' }, { status: 413 });
      }

      let parsed;
      try {
        parsed = await parseProductWorkbook(Buffer.from(await file.arrayBuffer()));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to read spreadsheet.';
        return NextResponse.json({ error: message }, { status: 400 });
      }
      if (parsed.products.length > MAX_PRODUCTS) {
        return NextResponse.json({ error: `A spreadsheet can contain at most ${MAX_PRODUCTS} product rows.` }, { status: 400 });
      }

      const database = await connectDatabase();
      const productCodes = parsed.products.map((product) => product.sku.trim().toUpperCase());
      const existingCodes = productCodes.length
        ? await database.collection('products')
            .find({ productCode: { $in: productCodes } }, { projection: { productCode: 1 } })
            .toArray()
        : [];
      const existing = new Set(existingCodes.map((product) => String(product.productCode).toUpperCase()));
      const duplicateErrors = parsed.products.flatMap((product, index) => {
        const code = product.sku.trim().toUpperCase();
        return existing.has(code)
          ? [{ row: parsed.productRows[index], productCode: product.sku, reasons: ['Product code already exists in the catalog.'] }]
          : [];
      });
      const errors = [...parsed.errors, ...duplicateErrors].sort((a, b) => a.row - b.row);

      return NextResponse.json({
        products: errors.length ? [] : parsed.products,
        validCount: parsed.products.length,
        errorCount: errors.length,
        errors: errors.slice(0, 100),
        canImport: parsed.products.length > 0 && errors.length === 0,
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Import confirmation must be valid JSON.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || !('products' in body) || !Array.isArray(body.products)) {
      return NextResponse.json({ error: 'A validated product list is required.' }, { status: 400 });
    }
    const products = body.products as unknown[];
    if (products.length < 1 || products.length > MAX_PRODUCTS || !products.every(validateProductInput)) {
      return NextResponse.json({ error: `Provide 1 to ${MAX_PRODUCTS} valid products.` }, { status: 400 });
    }

    const documents = (products as ProductInput[]).map((product) => ({
      ...toProductDocument(product),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: new ObjectId(user.id),
    }));
    const codes = documents.map((product) => product.productCode);
    if (new Set(codes).size !== codes.length) {
      return NextResponse.json({ error: 'The import contains duplicate product codes.' }, { status: 409 });
    }

    const database = await connectDatabase();
    const client = database.client;
    const session: ClientSession = client.startSession();
    try {
      session.startTransaction();
      const existing = await database.collection('products').find(
        { productCode: { $in: codes } },
        { projection: { productCode: 1 }, session }
      ).toArray();
      if (existing.length) {
        await session.abortTransaction();
        return NextResponse.json(
          { error: `Product code already exists: ${existing[0].productCode}. Preview the spreadsheet again.` },
          { status: 409 }
        );
      }
      await database.collection('products').insertMany(documents, { ordered: true, session });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        return NextResponse.json({ error: 'A product code was added by another request. Preview the spreadsheet again.' }, { status: 409 });
      }
      throw error;
    } finally {
      await session.endSession();
    }
    return NextResponse.json({ imported: documents.length });
  } catch (error) {
    console.error('Product spreadsheet import failed:', error);
    return NextResponse.json({ error: 'Unable to import products. Check the database connection and try again.' }, { status: 503 });
  }
}
