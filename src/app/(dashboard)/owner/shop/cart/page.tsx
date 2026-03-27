"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertCircle, CheckCircle2, Loader2, Trash2 } from "lucide-react";

type ProductItem = {
  _id: string;
  name: string;
  price: number;
  imageUrl?: string;
  stock: number;
};

type CartItem = {
  _id: string;
  quantity: number;
  productId: ProductItem;
};

type CartData = {
  items: CartItem[];
};

type ProfileData = {
  address?: string;
};

export default function OwnerCartPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cart, setCart] = useState<CartData>({ items: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [shippingAddress, setShippingAddress] = useState("");
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const handledPaymentRef = useRef<string>("");

  const subtotal = useMemo(
    () =>
      cart.items.reduce(
        (sum, item) =>
          sum + Number(item.productId?.price ?? 0) * Number(item.quantity ?? 0),
        0
      ),
    [cart.items]
  );

  const loadCart = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not load cart.");
      }
      setCart({
        items: Array.isArray(responseData?.items) ? responseData.items : [],
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Could not load cart.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void loadCart();

      void (async () => {
        try {
          const response = await fetch("/api/users/profile", {
            cache: "no-store",
          });
          if (!response.ok) {
            return;
          }
          const profile = (await response.json()) as ProfileData;
          const address = profile?.address?.trim();
          if (address) {
            setShippingAddress(address);
          }
        } catch {
          // Optional prefill. Cart should remain usable even if this fails.
        }
      })();
    }
  }, [status, loadCart]);

  const updateQuantity = async (itemId: string, quantity: number) => {
    setBusyItemId(itemId);
    setFeedback(null);
    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not update cart item.");
      }
      setCart({
        items: Array.isArray(responseData?.items) ? responseData.items : [],
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not update item.",
      });
    } finally {
      setBusyItemId(null);
    }
  };

  const removeItem = async (itemId: string) => {
    setBusyItemId(itemId);
    setFeedback(null);
    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: "DELETE",
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not remove cart item.");
      }
      setCart({
        items: Array.isArray(responseData?.items) ? responseData.items : [],
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not remove item.",
      });
    } finally {
      setBusyItemId(null);
    }
  };

  const confirmStripePayment = useCallback(
    async (sessionId: string) => {
      setIsCheckingOut(true);
      setFeedback(null);

      try {
        const response = await fetch("/api/orders/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const responseData = await response.json();
        if (!response.ok) {
          throw new Error(
            responseData?.message ?? "Could not confirm Stripe payment."
          );
        }

        setFeedback({
          type: "success",
          message: `Payment successful. Order ID: ${responseData?._id ?? "-"}`,
        });
        await loadCart();
      } catch (error) {
        setFeedback({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not confirm Stripe payment.",
        });
      } finally {
        setIsCheckingOut(false);
        router.replace("/owner/shop/cart");
      }
    },
    [loadCart, router]
  );

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const paymentStatus = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");
    const eventKey = `${paymentStatus ?? ""}:${sessionId ?? ""}`;

    if (!paymentStatus || handledPaymentRef.current === eventKey) {
      return;
    }

    handledPaymentRef.current = eventKey;

    if (paymentStatus === "cancelled") {
      setFeedback({
        type: "error",
        message: "Stripe payment was cancelled.",
      });
      router.replace("/owner/shop/cart");
      return;
    }

    if (paymentStatus === "success" && sessionId) {
      void confirmStripePayment(sessionId);
    }
  }, [confirmStripePayment, router, searchParams, status]);

  const checkout = async (paymentOption: "UPI" | "CARD") => {
    const normalizedAddress = shippingAddress.trim();
    if (!normalizedAddress) {
      setFeedback({
        type: "error",
        message: "Please add delivery address before placing order.",
      });
      return;
    }

    setIsCheckingOut(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/orders/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddress: normalizedAddress,
          paymentOption,
        }),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(
          responseData?.message ?? "Could not initialize Stripe checkout."
        );
      }

      if (typeof responseData?.url !== "string") {
        throw new Error("Stripe checkout URL is missing.");
      }

      window.location.href = responseData.url;
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not initialize Stripe checkout.",
      });
      setIsCheckingOut(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading cart...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
          Login required to access cart.
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Your Cart</h1>
        <p className="mt-1 text-sm text-slate-600">
          Update quantities and place your order.
        </p>
      </section>

      {feedback ? (
        <div
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{feedback.message}</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {isLoading ? (
            <p className="text-sm text-slate-600">Loading items...</p>
          ) : cart.items.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Your cart is empty.</p>
              <Link
                href="/owner/shop"
                className="inline-block rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                Back to shop
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.items.map((item) => (
                <article
                  key={item._id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.productId?.imageUrl || "/images/default-pet.png"}
                        alt={item.productId?.name ?? "Product image"}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="flex-1">
                      <h2 className="font-semibold text-slate-900">
                        {item.productId?.name ?? "Unknown product"}
                      </h2>
                      <p className="text-xs text-slate-500">
                        ₹{Number(item.productId?.price ?? 0).toFixed(2)} | Stock:{" "}
                        {item.productId?.stock ?? 0}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busyItemId === item._id || item.quantity <= 1}
                          onClick={() => updateQuantity(item._id, item.quantity - 1)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          -
                        </button>
                        <span className="min-w-8 text-center text-sm font-medium text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={
                            busyItemId === item._id ||
                            item.quantity >= Number(item.productId?.stock ?? 0)
                          }
                          onClick={() => updateQuantity(item._id, item.quantity + 1)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          disabled={busyItemId === item._id}
                          onClick={() => removeItem(item._id)}
                          className="ml-auto rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="inline-flex items-center gap-1">
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Checkout</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              Items:{" "}
              <span className="font-medium">
                {cart.items.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              Total: <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label
              htmlFor="shipping-address"
              className="text-sm font-medium text-slate-700"
            >
              Delivery Address
            </label>
            <textarea
              id="shipping-address"
              value={shippingAddress}
              onChange={(event) => setShippingAddress(event.target.value)}
              placeholder="House, road, area, city"
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            />
          </div>

          <button
            type="button"
            onClick={() => void checkout("UPI")}
            disabled={isCheckingOut || cart.items.length === 0}
            className="mt-4 flex w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isCheckingOut ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to Stripe...
              </>
            ) : (
              "Pay"
            )}
          </button>

          

          

          <Link
            href="/owner/shop"
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-sm text-slate-700 transition hover:bg-slate-100"
          >
            Continue Shopping
          </Link>
        </section>
      </div>
    </main>
  );
}
