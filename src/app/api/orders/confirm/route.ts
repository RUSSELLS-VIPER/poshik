import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import Order from "@/lib/db/models/Order";
import {
  CreateOrderError,
  createOrderFromCart,
} from "@/lib/orders/create-order-from-cart";
import { getStripeClient } from "@/lib/payments/stripe";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let requestedSessionId = "";

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const sessionId =
      typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";
    requestedSessionId = sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { message: "Stripe session id is required." },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    const metadataUserId = checkoutSession.metadata?.userId ?? "";
    const referenceUserId = checkoutSession.client_reference_id ?? "";
    const sessionOwnerId = metadataUserId || referenceUserId;

    if (!sessionOwnerId || sessionOwnerId !== userId) {
      return NextResponse.json(
        { message: "This payment session does not belong to you." },
        { status: 403 }
      );
    }

    if (checkoutSession.payment_status !== "paid") {
      return NextResponse.json(
        { message: "Payment is not completed yet." },
        { status: 400 }
      );
    }

    await connectDB();

    const existingOrder = await Order.findOne({
      stripeSessionId: checkoutSession.id,
    });
    if (existingOrder) {
      return NextResponse.json(existingOrder);
    }

    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id ?? "";

    const order = await createOrderFromCart({
      userId,
      shippingAddress: checkoutSession.metadata?.shippingAddress ?? "",
      notes: checkoutSession.metadata?.notes ?? "",
      paymentMethod: "STRIPE",
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
      stripeSessionId: checkoutSession.id,
      stripePaymentIntentId: paymentIntentId,
    });

    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof CreateOrderError) {
      if (error.message === "Cart is empty.") {
        if (requestedSessionId) {
          await connectDB();
          const existingOrder = await Order.findOne({
            stripeSessionId: requestedSessionId,
          });
          if (existingOrder) {
            return NextResponse.json(existingOrder);
          }
        }
      }

      return NextResponse.json(
        { message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Stripe payment confirm error:", error);
    return NextResponse.json(
      { message: "Could not confirm Stripe payment." },
      { status: 500 }
    );
  }
}
