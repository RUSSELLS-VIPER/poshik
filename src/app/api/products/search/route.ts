import { connectDB } from "@/lib/db/mongodb";
import Product from "@/lib/db/models/Product";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  const products = await Product.find({
    name: { $regex: q, $options: "i" },
  });

  return NextResponse.json(products);
}