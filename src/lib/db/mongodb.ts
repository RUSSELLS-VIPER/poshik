import mongoose, { type Mongoose } from "mongoose";

type MongooseCache = {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached = globalThis.mongooseCache ?? {
  conn: null,
  promise: null,
};

globalThis.mongooseCache = cached;

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
  return cached.conn;
}
