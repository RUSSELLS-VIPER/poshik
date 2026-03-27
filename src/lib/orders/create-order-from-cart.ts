import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongodb";
import Cart from "@/lib/db/models/Cart";
import Order from "@/lib/db/models/Order";
import Product from "@/lib/db/models/Product";
import { notifyOrderStatusChange } from "@/lib/notifications/status";

export class CreateOrderError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

type CreateOrderFromCartInput = {
  userId: string;
  shippingAddress?: string;
  notes?: string;
  paymentMethod?: "OFFLINE" | "STRIPE";
  paymentStatus?: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  orderStatus?: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
};

export async function createOrderFromCart({
  userId,
  shippingAddress = "",
  notes = "",
  paymentMethod = "OFFLINE",
  paymentStatus = "PENDING",
  orderStatus = "PENDING",
  stripeSessionId = "",
  stripePaymentIntentId = "",
}: CreateOrderFromCartInput) {
  await connectDB();

  const cart = await Cart.findOne({ userId }).populate("items.productId");
  if (!cart || cart.items.length === 0) {
    throw new CreateOrderError("Cart is empty.", 400);
  }

  const orderItems: Array<{
    productId: mongoose.Types.ObjectId;
    shopId: mongoose.Types.ObjectId;
    name: string;
    price: number;
    quantity: number;
    imageUrl: string;
  }> = [];

  const productUpdates: Array<{
    updateOne: {
      filter: { _id: mongoose.Types.ObjectId };
      update: { $inc: { stock: number } };
    };
  }> = [];

  let total = 0;

  for (const cartItem of cart.items) {
    const product = await Product.findById(cartItem.productId);

    if (!product || !product.isActive) {
      throw new CreateOrderError(
        `Product unavailable: ${cartItem.productId}`,
        400
      );
    }

    if (product.stock < cartItem.quantity) {
      throw new CreateOrderError(
        `Insufficient stock for ${product.name}. Available: ${product.stock}`,
        400
      );
    }

    if (!product.shopId) {
      throw new CreateOrderError(
        `Product ${product.name} is missing shop ownership.`,
        400
      );
    }

    const linePrice = Number(product.price) * Number(cartItem.quantity);
    total += linePrice;

    orderItems.push({
      productId: product._id,
      shopId: product.shopId,
      name: product.name,
      price: Number(product.price),
      quantity: Number(cartItem.quantity),
      imageUrl: product.imageUrl ?? "",
    });

    productUpdates.push({
      updateOne: {
        filter: { _id: product._id },
        update: { $inc: { stock: -Number(cartItem.quantity) } },
      },
    });
  }

  try {
    const order = await Order.create({
      userId,
      items: orderItems,
      total,
      shippingAddress,
      notes,
      status: orderStatus,
      paymentMethod,
      paymentStatus,
      stripeSessionId,
      stripePaymentIntentId,
    });

    try {
      const shopIds = Array.from(
        new Set(orderItems.map((item) => item.shopId.toString()).filter(Boolean))
      );

      await notifyOrderStatusChange({
        orderId: order._id.toString(),
        buyerId: String(userId),
        shopIds,
        nextStatus: orderStatus,
        actorRole: paymentMethod === "STRIPE" ? "SYSTEM_STRIPE" : "OWNER",
      });
    } catch (notificationError) {
      console.error("Order create notification error:", notificationError);
    }

    if (productUpdates.length > 0) {
      await Product.bulkWrite(productUpdates);
    }

    cart.items = [];
    await cart.save();

    return order;
  } catch (error) {
    if (stripeSessionId && error && typeof error === "object") {
      const maybeMongoError = error as { code?: number };
      if (maybeMongoError.code === 11000) {
        const existingOrder = await Order.findOne({ stripeSessionId });
        if (existingOrder) {
          return existingOrder;
        }
      }
    }

    throw error;
  }
}
