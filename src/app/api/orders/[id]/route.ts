import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import Order from "@/lib/db/models/Order";
import { notifyOrderStatusChange } from "@/lib/notifications/status";

type RouteContext = {
  params: {
    id: string;
  };
};

const SHOP_ALLOWED_STATUSES = new Set([
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);
const ALL_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

function isShopOrder(order: any, userId: string): boolean {
  if (!Array.isArray(order?.items)) {
    return false;
  }

  return order.items.some(
    (item: { shopId: mongoose.Types.ObjectId }) =>
      item.shopId?.toString() === userId
  );
}

function uniqueShopIds(order: any): string[] {
  if (!Array.isArray(order?.items)) {
    return [];
  }

  return Array.from(
    new Set(
      order.items
        .map((item: { shopId?: mongoose.Types.ObjectId }) =>
          item?.shopId ? item.shopId.toString() : ""
        )
        .filter(Boolean)
    )
  );
}

export async function GET(_: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!isValidObjectId(params.id)) {
      return NextResponse.json({ message: "Invalid order id." }, { status: 400 });
    }

    await connectDB();

    const order = await Order.findById(params.id).populate("userId", "name email");
    if (!order) {
      return NextResponse.json({ message: "Order not found." }, { status: 404 });
    }

    if (
      role !== "ADMIN" &&
      order.userId?._id?.toString() !== userId &&
      !isShopOrder(order, userId)
    ) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    if (role === "SHOP") {
      const filteredItems = Array.isArray(order.items)
        ? order.items.filter(
            (item: { shopId: mongoose.Types.ObjectId }) =>
              item.shopId?.toString() === userId
          )
        : [];
      const filteredTotal = filteredItems.reduce(
        (sum: number, item: { price: number; quantity: number }) =>
          sum + Number(item.price) * Number(item.quantity),
        0
      );

      return NextResponse.json({
        ...order.toObject(),
        items: filteredItems,
        total: filteredTotal,
      });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Order GET by id error:", error);
    return NextResponse.json(
      { message: "Could not fetch order." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!isValidObjectId(params.id)) {
      return NextResponse.json({ message: "Invalid order id." }, { status: 400 });
    }

    await connectDB();

    const order = await Order.findById(params.id);
    if (!order) {
      return NextResponse.json({ message: "Order not found." }, { status: 404 });
    }

    const body = await req.json();
    const nextStatus =
      typeof body?.status === "string" ? body.status.trim().toUpperCase() : "";

    if (!nextStatus) {
      return NextResponse.json(
        { message: "Status is required." },
        { status: 400 }
      );
    }

    const previousStatus = String(order.status ?? "");
    const buyerId = order.userId?.toString() ?? "";
    const shopIds = uniqueShopIds(order);

    const saveAndNotify = async (resolvedStatus: string) => {
      const hasChanged = previousStatus !== resolvedStatus;
      order.status = resolvedStatus;
      await order.save();

      if (hasChanged) {
        try {
          await notifyOrderStatusChange({
            orderId: order._id.toString(),
            buyerId,
            shopIds,
            nextStatus: resolvedStatus,
            previousStatus,
            actorRole: role,
          });
        } catch (notificationError) {
          console.error("Order notification error:", notificationError);
        }
      }

      return NextResponse.json(order);
    };

    if (role === "ADMIN") {
      if (!ALL_STATUSES.has(nextStatus)) {
        return NextResponse.json(
          { message: "Invalid order status." },
          { status: 400 }
        );
      }
      return saveAndNotify(nextStatus);
    }

    if (role === "SHOP") {
      if (!isShopOrder(order, userId)) {
        return NextResponse.json({ message: "Forbidden." }, { status: 403 });
      }

      if (!SHOP_ALLOWED_STATUSES.has(nextStatus)) {
        return NextResponse.json(
          { message: "Invalid status for shop owner." },
          { status: 400 }
        );
      }

      return saveAndNotify(nextStatus);
    }

    if (order.userId?.toString() !== userId) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    if (nextStatus !== "CANCELLED") {
      return NextResponse.json(
        { message: "Buyers can only cancel orders." },
        { status: 400 }
      );
    }

    if (!["PENDING", "CONFIRMED"].includes(order.status)) {
      return NextResponse.json(
        { message: "Order can no longer be cancelled." },
        { status: 400 }
      );
    }

    return saveAndNotify("CANCELLED");
  } catch (error) {
    console.error("Order PATCH error:", error);
    return NextResponse.json(
      { message: "Could not update order status." },
      { status: 500 }
    );
  }
}
