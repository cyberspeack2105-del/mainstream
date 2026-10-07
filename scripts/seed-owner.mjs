import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE || 'electric';
const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
const passwordHash = process.env.ADMIN_PASSWORD_HASH;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const sessionSecret = process.env.ADMIN_SESSION_SECRET;

if (!uri) throw new Error('MONGODB_URI is required.');
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('ADMIN_SESSION_SECRET must contain at least 32 characters.');
}
if (!username) throw new Error('ADMIN_USERNAME is required.');
if (!passwordHash || !/^\$2[aby]\$(0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/.test(passwordHash)) {
  throw new Error('ADMIN_PASSWORD_HASH must contain a bcrypt hash. Plain-text passwords are not accepted.');
}
if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('ADMIN_EMAIL must be a valid email address when provided.');
}
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

try {
  await client.connect();
  const database = client.db(databaseName);
  const users = database.collection('users');
  await users.createIndex({ username: 1 }, { unique: true });
  await users.createIndex({ email: 1 }, { unique: true, sparse: true });

  if (await users.findOne({ role: 'OWNER' })) {
    console.log('An OWNER account already exists; no account was changed.');
    process.exitCode = 0;
  } else {
    const now = new Date();
    await users.insertOne({
      username,
      ...(email ? { email } : {}),
      passwordHash,
      role: 'OWNER',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    console.log('Initial OWNER account created from the configured bcrypt hash.');
  }
} finally {
  await client.close();
}
