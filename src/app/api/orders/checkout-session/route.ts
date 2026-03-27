import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import Cart from "@/lib/db/models/Cart";
import Product from "@/lib/db/models/Product";
import { getStripeClient } from "@/lib/payments/stripe";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

function getAppBaseUrl(req: Request) {
  const envBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, "");
  }
  return new URL(req.url).origin;
}

function normalizeCurrency() {
  return (process.env.STRIPE_CURRENCY ?? "inr").toLowerCase();
}

export async function POST(req: Request) {
  let paymentOption: "UPI" | "CARD" = "CARD";

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
    const notes = typeof payload?.notes === "string" ? payload.notes.trim() : "";
    paymentOption =
      typeof payload?.paymentOption === "string"
        ? payload.paymentOption.trim().toUpperCase()
        : "CARD";
    paymentOption = paymentOption === "UPI" ? "UPI" : "CARD";

    if (!shippingAddress) {
      return NextResponse.json(
        { message: "Delivery address is required." },
        { status: 400 }
      );
    }

    await connectDB();

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ message: "Cart is empty." }, { status: 400 });
    }

    const stripeLineItems: Array<{
      price_data: {
        currency: string;
        product_data: { name: string; description?: string };
        unit_amount: number;
      };
      quantity: number;
    }> = [];

    for (const cartItem of cart.items) {
      const product = await Product.findById(cartItem.productId);

      if (!product || !product.isActive) {
        return NextResponse.json(
          { message: `Product unavailable: ${cartItem.productId}` },
          { status: 400 }
        );
      }

      if (product.stock < cartItem.quantity) {
        return NextResponse.json(
          {
            message: `Insufficient stock for ${product.name}. Available: ${product.stock}`,
          },
          { status: 400 }
        );
      }

      const unitAmount = Math.round(Number(product.price) * 100);
      if (unitAmount <= 0) {
        return NextResponse.json(
          {
            message: `Product ${product.name} has invalid price for Stripe checkout.`,
          },
          { status: 400 }
        );
      }

      stripeLineItems.push({
        price_data: {
          currency: normalizeCurrency(),
          product_data: {
            name: product.name,
            description: product.description?.slice(0, 250) || undefined,
          },
          unit_amount: unitAmount,
        },
        quantity: Number(cartItem.quantity),
      });
    }

    const stripe = getStripeClient();
    const appBaseUrl = getAppBaseUrl(req);
    const paymentMethodTypes = (
      paymentOption === "UPI" ? ["upi", "card"] : ["card"]
    ) as unknown as Stripe.Checkout.SessionCreateParams.PaymentMethodType[];

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: stripeLineItems,
      payment_method_types: paymentMethodTypes,
      success_url: `${appBaseUrl}/owner/shop/cart?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/owner/shop/cart?payment=cancelled`,
      client_reference_id: userId,
      customer_email:
        typeof session.user?.email === "string" ? session.user.email : undefined,
      metadata: {
        userId,
        shippingAddress: shippingAddress.slice(0, 500),
        notes: notes.slice(0, 500),
        preferredPaymentOption: paymentOption,
      },
      payment_intent_data: {
        metadata: {
          userId,
        },
      },
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { message: "Could not create Stripe checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message.toLowerCase() : "";

    if (
      paymentOption === "UPI" &&
      (errorMessage.includes("upi") ||
        errorMessage.includes("payment method") ||
        errorMessage.includes("currency"))
    ) {
      return NextResponse.json(
        {
          message:
            "UPI is currently unavailable for this Stripe setup. Enable UPI in Stripe Dashboard and use INR currency.",
        },
        { status: 400 }
      );
    }

    console.error("Stripe checkout session error:", error);
    return NextResponse.json(
      { message: "Could not initialize Stripe checkout." },
      { status: 500 }
    );
  }
}
