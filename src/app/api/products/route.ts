import { connectDB } from "@/lib/db/mongodb";
import Product from "@/lib/db/models/Product";
import { authOptions } from "@/lib/auth/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (role !== "SHOP" && role !== "ADMIN") {
      return NextResponse.json(
        { message: "Only shop owners can create products." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description =
      typeof body?.description === "string" ? body.description.trim() : "";
    const price = Number(body?.price ?? 0);
    const stock = Number(body?.stock ?? 0);
    const category =
      typeof body?.category === "string" ? body.category.trim() : "GENERAL";
    const imageUrl =
      typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
    const isActive =
      typeof body?.isActive === "boolean" ? body.isActive : true;

    if (!name) {
      return NextResponse.json(
        { message: "Product name is required." },
        { status: 400 }
      );
    }

    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json(
        { message: "Price must be 0 or greater." },
        { status: 400 }
      );
    }

    if (Number.isNaN(stock) || stock < 0) {
      return NextResponse.json(
        { message: "Stock must be 0 or greater." },
        { status: 400 }
      );
    }

    await connectDB();

    const shopId =
      role === "ADMIN" &&
      typeof body?.shopId === "string" &&
      mongoose.Types.ObjectId.isValid(body.shopId)
        ? body.shopId
        : userId;

    const product = await Product.create({
      shopId,
      name,
      description,
      price,
      stock,
      category: category || "GENERAL",
      imageUrl,
      isActive,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Product POST error:", error);
    return NextResponse.json(
      { message: "Could not create product." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const mine = searchParams.get("mine") === "true";
    const includeInactive = searchParams.get("includeInactive") === "true";

    if (mine) {
      const session = await getServerSession(authOptions);
      const userId = session?.user?.id;
      const role = session?.user?.role;

      if (!userId) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      if (role !== "SHOP" && role !== "ADMIN") {
        return NextResponse.json(
          { message: "Only shop owners can view this list." },
          { status: 403 }
        );
      }

      const query: Record<string, unknown> = {
        shopId:
          role === "ADMIN"
            ? (() => {
                const candidate = searchParams.get("shopId");
                if (candidate && mongoose.Types.ObjectId.isValid(candidate)) {
                  return candidate;
                }
                return userId;
              })()
            : userId,
      };

      if (!includeInactive) {
        query.isActive = true;
      }

      const products = await Product.find(query).sort({ createdAt: -1 });
      return NextResponse.json(products);
    }

    const query: Record<string, unknown> = {};
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    let canViewInactive = false;

    if (includeInactive) {
      const session = await getServerSession(authOptions);
      const role = session?.user?.role;
      canViewInactive = role === "OWNER" || role === "ADMIN";
    }

    if (!canViewInactive) {
      query.isActive = true;
    }

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(query)
      .populate("shopId", "name email")
      .sort({ createdAt: -1 });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Product GET error:", error);
    return NextResponse.json(
      { message: "Could not fetch products." },
      { status: 500 }
    );
  }
}
