// This file has been deprecated. Database functionality has been moved to FastAPI implementation.
// Please use the Python SQLAlchemy/FastAPI implementation instead of Node.js database connections.

// Original configuration kept for reference:
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Deprecated: Do not use these exports
export const pool = undefined;
export const db = undefined;