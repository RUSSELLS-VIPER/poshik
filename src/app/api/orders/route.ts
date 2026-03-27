import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import Order from "@/lib/db/models/Order";
import {
  CreateOrderError,
  createOrderFromCart,
} from "@/lib/orders/create-order-from-cart";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const shippingAddress =
      typeof payload?.shippingAddress === "string"
        ? payload.shippingAddress.trim()
        : "";
    const notes =
      typeof payload?.notes === "string" ? payload.notes.trim() : "";

    const order = await createOrderFromCart({
      userId,
      shippingAddress,
      notes,
      paymentMethod: "OFFLINE",
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof CreateOrderError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Order POST error:", error);
    return NextResponse.json(
      { message: "Could not place order." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const query: Record<string, unknown> = {};

    if (role === "SHOP") {
      query["items.shopId"] = userId;
    } else if (role !== "ADMIN") {
      query.userId = userId;
    }

    const orders = await Order.find(query)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    if (role === "SHOP") {
      const shopOrders = orders.map((order) => {
        const shopItems = Array.isArray(order.items)
          ? order.items.filter(
              (item: { shopId: mongoose.Types.ObjectId | string }) =>
                item.shopId?.toString() === userId
            )
          : [];

        const shopTotal = shopItems.reduce(
          (sum: number, item: { price: number; quantity: number }) =>
            sum + Number(item.price) * Number(item.quantity),
          0
        );

        return {
          ...order,
          items: shopItems,
          total: shopTotal,
        };
      });

      return NextResponse.json(shopOrders);
    }

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Order GET error:", error);
    return NextResponse.json(
      { message: "Could not fetch orders." },
      { status: 500 }
    );
  }
}
