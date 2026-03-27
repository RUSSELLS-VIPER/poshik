import { connectDB } from "@/lib/db/mongodb";
import Order from "@/lib/db/models/Order";
import {
  CreateOrderError,
  createOrderFromCart,
} from "@/lib/orders/create-order-from-cart";
import { getStripeClient } from "@/lib/payments/stripe";
import { NextResponse } from "next/server";
import Stripe from "stripe";

async function handleCheckoutCompleted(
  checkoutSession: Stripe.Checkout.Session
) {
  const userId =
    checkoutSession.metadata?.userId ?? checkoutSession.client_reference_id ?? "";

  if (!userId) {
    return;
  }

  await connectDB();

  const existingOrder = await Order.findOne({
    stripeSessionId: checkoutSession.id,
  });
  if (existingOrder) {
    return;
  }

  const paymentIntentId =
    typeof checkoutSession.payment_intent === "string"
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent &&
          typeof checkoutSession.payment_intent === "object"
        ? checkoutSession.payment_intent.id
        : "";

  try {
    await createOrderFromCart({
      userId,
      shippingAddress: checkoutSession.metadata?.shippingAddress ?? "",
      notes: checkoutSession.metadata?.notes ?? "",
      paymentMethod: "STRIPE",
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
      stripeSessionId: checkoutSession.id,
      stripePaymentIntentId: paymentIntentId,
    });
  } catch (error) {
    if (error instanceof CreateOrderError) {
      if (error.message === "Cart is empty.") {
        return;
      }
      throw error;
    }

    throw error;
  }
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { message: "Missing Stripe webhook configuration." },
      { status: 400 }
    );
  }

  const payload = await req.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Invalid Stripe signature.",
      },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(checkoutSession);
    }
  } catch (error) {
    console.error("Stripe webhook processing error:", error);
    return NextResponse.json(
      { message: "Webhook processing failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
