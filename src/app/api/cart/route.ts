import { connectDB } from "@/lib/db/mongodb";
import Cart from "@/lib/db/models/Cart";
import Product from "@/lib/db/models/Product";
import { authOptions } from "@/lib/auth/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const productId =
      typeof body?.productId === "string" ? body.productId : "";
    const quantity = Number(body?.quantity ?? 1);

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return NextResponse.json(
        { message: "Invalid product id." },
        { status: 400 }
      );
    }

    if (Number.isNaN(quantity) || quantity < 1) {
      return NextResponse.json(
        { message: "Quantity must be at least 1." },
        { status: 400 }
      );
    }

    await connectDB();

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return NextResponse.json(
        { message: "Product is unavailable." },
        { status: 404 }
      );
    }

    if (product.stock < quantity) {
      return NextResponse.json(
        { message: "Requested quantity is more than available stock." },
        { status: 400 }
      );
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = await Cart.create({
        userId,
        items: [],
      });
    }

    const existingItem = cart.items.find(
      (item: { productId: mongoose.Types.ObjectId; quantity: number }) =>
        item.productId?.toString() === productId
    );

    if (existingItem) {
      const nextQuantity = existingItem.quantity + quantity;
      if (nextQuantity > product.stock) {
        return NextResponse.json(
          { message: "Cart quantity exceeds available stock." },
          { status: 400 }
        );
      }
      existingItem.quantity = nextQuantity;
    } else {
      cart.items.push({
        productId,
        quantity,
      });
    }

    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate("items.productId");
    return NextResponse.json(populatedCart);
  } catch (error) {
    console.error("Cart POST error:", error);
    return NextResponse.json(
      { message: "Could not add item to cart." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const cart = await Cart.findOne({ userId })
      .populate("items.productId")
      .lean();

    if (!cart) {
      return NextResponse.json({
        userId,
        items: [],
      });
    }

    return NextResponse.json(cart);
  } catch (error) {
    console.error("Cart GET error:", error);
    return NextResponse.json(
      { message: "Could not fetch cart." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    await Cart.findOneAndUpdate({ userId }, { items: [] }, { upsert: true });

    return NextResponse.json({ message: "Cart cleared." });
  } catch (error) {
    console.error("Cart DELETE error:", error);
    return NextResponse.json(
      { message: "Could not clear cart." },
      { status: 500 }
    );
  }
}
