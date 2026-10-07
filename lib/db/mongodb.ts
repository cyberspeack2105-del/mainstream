import { MongoClient, type Db } from 'mongodb';

const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE || 'electric';

type MongoCache = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
  indexesPromise: Promise<void> | null;
};

const globalWithMongo = globalThis as typeof globalThis & {
  _mainStreamMongo?: MongoCache;
};

const cache = (globalWithMongo._mainStreamMongo ??= {
  client: null,
  promise: null,
  indexesPromise: null,
});

export async function connectDatabase(): Promise<Db> {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required to use the application database.');
  }

  if (!cache.promise) {
    cache.promise = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 10,
    })
      .connect()
      .then((client) => {
        cache.client = client;
        return client;
      })
      .catch((error: unknown) => {
        cache.promise = null;
        throw error;
      });
  }

  const client = await cache.promise;
  const database = client.db(databaseName);

  if (!cache.indexesPromise) {
    cache.indexesPromise = Promise.all([
      database.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true }),
      database.collection('users').createIndex({ username: 1 }, { unique: true }),
      database.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      database.collection('products').createIndex({ productCode: 1 }, { unique: true }),
      database.collection('products').createIndex({ isActive: 1, productName: 1 }),
      database.collection('customers').createIndex({ isActive: 1, name: 1 }),
      database.collection('customers').createIndex({ phone: 1 }),
      database.collection('suppliers').createIndex({ isActive: 1, name: 1 }),
      database.collection('suppliers').createIndex({ phone: 1 }),
      database.collection('purchases').createIndex({ supplierId: 1, invoiceNumber: 1 }, { unique: true }),
      database.collection('stockMovements').createIndex({ createdAt: -1 }),
    ])
      .then(() => undefined)
      .catch((error: unknown) => {
        cache.indexesPromise = null;
        throw error;
      });
  }
  await cache.indexesPromise;

  return database;
}
