import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import Cart from "@/lib/db/models/Cart";
import Product from "@/lib/db/models/Product";

type RouteContext = {
  params: {
    id: string;
  };
};

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!isValidObjectId(params.id)) {
      return NextResponse.json({ message: "Invalid item id." }, { status: 400 });
    }

    const body = await req.json();
    const quantity = Number(body?.quantity);

    if (Number.isNaN(quantity)) {
      return NextResponse.json(
        { message: "Quantity is required." },
        { status: 400 }
      );
    }

    await connectDB();

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return NextResponse.json({ message: "Cart not found." }, { status: 404 });
    }

    const item = cart.items.find(
      (cartItem: { _id: mongoose.Types.ObjectId }) =>
        cartItem._id?.toString() === params.id
    );

    if (!item) {
      return NextResponse.json(
        { message: "Cart item not found." },
        { status: 404 }
      );
    }

    if (quantity <= 0) {
      cart.items = cart.items.filter(
        (cartItem: { _id: mongoose.Types.ObjectId }) =>
          cartItem._id?.toString() !== params.id
      );
      await cart.save();
    } else {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        return NextResponse.json(
          { message: "Product is unavailable." },
          { status: 400 }
        );
      }

      if (quantity > product.stock) {
        return NextResponse.json(
          { message: "Quantity exceeds available stock." },
          { status: 400 }
        );
      }

      item.quantity = quantity;
      await cart.save();
    }

    const updatedCart = await Cart.findById(cart._id).populate("items.productId");
    return NextResponse.json(updatedCart);
  } catch (error) {
    console.error("Cart item PATCH error:", error);
    return NextResponse.json(
      { message: "Could not update cart item." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!isValidObjectId(params.id)) {
      return NextResponse.json({ message: "Invalid item id." }, { status: 400 });
    }

    await connectDB();

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return NextResponse.json({ message: "Cart not found." }, { status: 404 });
    }

    const before = cart.items.length;
    cart.items = cart.items.filter(
      (cartItem: { _id: mongoose.Types.ObjectId }) =>
        cartItem._id?.toString() !== params.id
    );

    if (before === cart.items.length) {
      return NextResponse.json(
        { message: "Cart item not found." },
        { status: 404 }
      );
    }

    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate("items.productId");
    return NextResponse.json(updatedCart);
  } catch (error) {
    console.error("Cart item DELETE error:", error);
    return NextResponse.json(
      { message: "Could not remove cart item." },
      { status: 500 }
    );
  }
}
