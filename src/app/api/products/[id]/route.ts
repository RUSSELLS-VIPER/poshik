import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import Product from "@/lib/db/models/Product";

type RouteContext = {
  params: {
    id: string;
  };
};

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function GET(_: Request, { params }: RouteContext) {
  try {
    if (!isValidObjectId(params.id)) {
      return NextResponse.json(
        { message: "Invalid product id." },
        { status: 400 }
      );
    }

    await connectDB();

    const product = await Product.findById(params.id).populate(
      "shopId",
      "name email"
    );
    if (!product) {
      return NextResponse.json(
        { message: "Product not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Product GET by id error:", error);
    return NextResponse.json(
      { message: "Could not fetch product." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (role !== "SHOP" && role !== "ADMIN") {
      return NextResponse.json(
        { message: "Only shop owners can update products." },
        { status: 403 }
      );
    }

    if (!isValidObjectId(params.id)) {
      return NextResponse.json(
        { message: "Invalid product id." },
        { status: 400 }
      );
    }

    await connectDB();

    const product = await Product.findById(params.id);
    if (!product) {
      return NextResponse.json(
        { message: "Product not found." },
        { status: 404 }
      );
    }

    if (role !== "ADMIN" && product.shopId?.toString() !== userId) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { message: "Name cannot be empty." },
          { status: 400 }
        );
      }
      updates.name = name;
    }

    if (typeof body?.description === "string") {
      updates.description = body.description.trim();
    }

    if (body?.price !== undefined) {
      const price = Number(body.price);
      if (Number.isNaN(price) || price < 0) {
        return NextResponse.json(
          { message: "Price must be 0 or greater." },
          { status: 400 }
        );
      }
      updates.price = price;
    }

    if (body?.stock !== undefined) {
      const stock = Number(body.stock);
      if (Number.isNaN(stock) || stock < 0) {
        return NextResponse.json(
          { message: "Stock must be 0 or greater." },
          { status: 400 }
        );
      }
      updates.stock = stock;
    }

    if (typeof body?.category === "string") {
      updates.category = body.category.trim() || "GENERAL";
    }

    if (typeof body?.imageUrl === "string") {
      updates.imageUrl = body.imageUrl.trim();
    }

    if (typeof body?.isActive === "boolean") {
      updates.isActive = body.isActive;
    }

    const updated = await Product.findByIdAndUpdate(params.id, updates, {
      new: true,
      runValidators: true,
    }).populate("shopId", "name email");

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Product PUT error:", error);
    return NextResponse.json(
      { message: "Could not update product." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (role !== "SHOP" && role !== "ADMIN") {
      return NextResponse.json(
        { message: "Only shop owners can delete products." },
        { status: 403 }
      );
    }

    if (!isValidObjectId(params.id)) {
      return NextResponse.json(
        { message: "Invalid product id." },
        { status: 400 }
      );
    }

    await connectDB();

    const product = await Product.findById(params.id);
    if (!product) {
      return NextResponse.json(
        { message: "Product not found." },
        { status: 404 }
      );
    }

    if (role !== "ADMIN" && product.shopId?.toString() !== userId) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    await Product.findByIdAndDelete(params.id);
    return NextResponse.json({ message: "Product deleted." });
  } catch (error) {
    console.error("Product DELETE error:", error);
    return NextResponse.json(
      { message: "Could not delete product." },
      { status: 500 }
    );
  }
}
