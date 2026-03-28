import mongoose, { type Mongoose } from "mongoose";

type MongooseCache = {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
  cleanupPromise: Promise<void> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached = globalThis.mongooseCache ?? {
  conn: null,
  promise: null,
  cleanupPromise: null,
};

globalThis.mongooseCache = cached;

async function cleanupLegacyUserIndexes(conn: Mongoose) {
  if (cached.cleanupPromise) {
    await cached.cleanupPromise;
    return;
  }

  cached.cleanupPromise = (async () => {
    try {
      const db = conn.connection.db;
      if (!db) {
        return;
      }

      const usersCollection = db.collection("users");
      const indexes = await usersCollection.indexes();
      const hasLegacyClerkIndex = indexes.some(
        (index) => index.name === "clerkId_1"
      );

      if (hasLegacyClerkIndex) {
        await usersCollection.dropIndex("clerkId_1");
      }
    } catch (error) {
      // Ignore missing collection/index and continue app startup.
      const message = error instanceof Error ? error.message : String(error);
      if (
        !message.includes("ns not found") &&
        !message.includes("index not found")
      ) {
        console.warn("Mongo index cleanup warning:", error);
      }
    }
  })();

  await cached.cleanupPromise;
}

export async function connectDB() {
  const mongodbUri = process.env.MONGODB_URI?.trim();
  if (!mongodbUri) {
    throw new Error("Please define MONGODB_URI");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongodbUri);
  }

  cached.conn = await cached.promise;
  await cleanupLegacyUserIndexes(cached.conn);
  return cached.conn;
}
