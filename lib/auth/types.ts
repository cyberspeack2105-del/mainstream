import type { ObjectId } from 'mongodb';

export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER';

export type UserDocument = {
  _id: ObjectId;
  email?: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SessionDocument = {
  _id: string;
  userId: ObjectId;
  expiresAt: Date;
  createdAt: Date;
};

export type SafeUser = {
  id: string;
  email: string | null;
  username: string;
  role: UserRole;
};
