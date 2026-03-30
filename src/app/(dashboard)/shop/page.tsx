"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import BuyerMarketplace from "@/components/shop/BuyerMarketplace";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Package,
  ShoppingBag,
} from "lucide-react";

type ProductItem = {
  _id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  imageUrl: string;
  isActive: boolean;
  createdAt?: string;
};

type ProductDraft = {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  imageUrl: string;
  isActive: boolean;
};

type OrderItem = {
  _id: string;
  status: string;
  total: number;
  createdAt?: string;
  userId?: {
    name?: string;
    email?: string;
  };
  items: Array<{
    _id?: string;
    name: string;
    quantity: number;
    price: number;
    shopId: string;
  }>;
};

const defaultDraft: ProductDraft = {
  name: "",
  description: "",
  price: 0,
  stock: 0,
  category: "FOOD",
  imageUrl: "",
  isActive: true,
};

const allOrderStatuses = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const shopEditableOrderStatuses = [
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

export default function ShopDashboardPage() {
  const { data: session, status } = useSession();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(defaultDraft);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<ProductDraft>(defaultDraft);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const role = session?.user?.role;

  const totalOrders = orders.length;
  const totalProducts = products.length;
  const totalRevenue = useMemo(
    () => orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0),
    [orders]
  );

  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const response = await fetch("/api/products?mine=true&includeInactive=true", {
        cache: "no-store",
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not fetch products.");
      }
      setProducts(Array.isArray(responseData) ? responseData : []);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not fetch your products.",
      });
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not fetch orders.");
      }
      setOrders(Array.isArray(responseData) ? responseData : []);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not fetch orders.",
      });
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    if (role !== "SHOP" && role !== "ADMIN") {
      return;
    }

    void loadProducts();
    void loadOrders();
  }, [status, role, loadOrders, loadProducts]);

  const onCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setIsSubmittingProduct(true);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not create product.");
      }

      setDraft(defaultDraft);
      setFeedback({ type: "success", message: "Product added successfully." });
      await loadProducts();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not create product.",
      });
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const onDeleteProduct = async (productId: string) => {
    setFeedback(null);
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not delete product.");
      }

      setFeedback({ type: "success", message: "Product deleted." });
      await loadProducts();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not delete product.",
      });
    }
  };

  const onSaveProductEdit = async (productId: string) => {
    setFeedback(null);
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingDraft),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not update product.");
      }

      setEditingProductId(null);
      setFeedback({ type: "success", message: "Product updated." });
      await loadProducts();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not update product.",
      });
    }
  };

  const onChangeOrderStatus = async (orderId: string, nextStatus: string) => {
    setFeedback(null);
    setUpdatingOrderId(orderId);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not update order.");
      }

      setOrders((previous) =>
        previous.map((order) =>
          order._id === orderId ? { ...order, status: responseData.status } : order
        )
      );
      setFeedback({ type: "success", message: "Order status updated." });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not update order status.",
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading shop dashboard...
        </div>
      </div>
    );
  }

  if (!session || (role !== "SHOP" && role !== "ADMIN")) {
    return <BuyerMarketplace />;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-violet-200 bg-gradient-to-r from-violet-700 via-violet-700 to-rose-700 p-6 text-white shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-100">
          Shop Owner Panel
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          Product and order management
        </h1>
        <p className="mt-2 text-sm text-violet-100/90">
          Add products, manage inventory, and update order status from one place.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-violet-100/90">Products</p>
            <p className="text-2xl font-semibold">{totalProducts}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-violet-100/90">Orders</p>
            <p className="text-2xl font-semibold">{totalOrders}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-violet-100/90">Revenue</p>
            <p className="text-2xl font-semibold">₹{totalRevenue.toFixed(2)}</p>
          </div>
        </div>
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

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-violet-700" />
            <h2 className="text-lg font-semibold text-slate-900">Add Product</h2>
          </div>

          <form className="space-y-3" onSubmit={onCreateProduct}>
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, name: event.target.value }))
              }
              placeholder="Product name"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              placeholder="Description"
              rows={3}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="number"
                min={0}
                value={draft.price}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    price: Number(event.target.value),
                  }))
                }
                placeholder="Price"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
              <input
                type="number"
                min={0}
                value={draft.stock}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    stock: Number(event.target.value),
                  }))
                }
                placeholder="Stock"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={draft.category}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    category: event.target.value,
                  }))
                }
                placeholder="Category"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
              <input
                value={draft.imageUrl}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    imageUrl: event.target.value,
                  }))
                }
                placeholder="Image URL"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    isActive: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Product is active
            </label>

            <button
              type="submit"
              disabled={isSubmittingProduct}
              className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-700 to-rose-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-700/20 transition hover:from-violet-800 hover:to-rose-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmittingProduct ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Create Product"
              )}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-violet-700" />
            <h2 className="text-lg font-semibold text-slate-900">
              Manage Products
            </h2>
          </div>

          {isLoadingProducts ? (
            <p className="text-sm text-slate-600">Loading products...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-slate-600">No products added yet.</p>
          ) : (
            <div className="space-y-3">
              {products.map((product) => {
                const isEditing = editingProductId === product._id;

                return (
                  <article
                    key={product._id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          value={editingDraft.name}
                          onChange={(event) =>
                            setEditingDraft((previous) => ({
                              ...previous,
                              name: event.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                        <textarea
                          value={editingDraft.description}
                          onChange={(event) =>
                            setEditingDraft((previous) => ({
                              ...previous,
                              description: event.target.value,
                            }))
                          }
                          rows={2}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            type="number"
                            min={0}
                            value={editingDraft.price}
                            onChange={(event) =>
                              setEditingDraft((previous) => ({
                                ...previous,
                                price: Number(event.target.value),
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                          <input
                            type="number"
                            min={0}
                            value={editingDraft.stock}
                            onChange={(event) =>
                              setEditingDraft((previous) => ({
                                ...previous,
                                stock: Number(event.target.value),
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            value={editingDraft.category}
                            onChange={(event) =>
                              setEditingDraft((previous) => ({
                                ...previous,
                                category: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                          <input
                            value={editingDraft.imageUrl}
                            onChange={(event) =>
                              setEditingDraft((previous) => ({
                                ...previous,
                                imageUrl: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={editingDraft.isActive}
                            onChange={(event) =>
                              setEditingDraft((previous) => ({
                                ...previous,
                                isActive: event.target.checked,
                              }))
                            }
                          />
                          Active
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onSaveProductEdit(product._id)}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingProductId(null)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-900">
                              {product.name}
                            </h3>
                            <p className="text-xs text-slate-500">
                              {product.category} | ₹{product.price} | Stock:{" "}
                              {product.stock}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              product.isActive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {product.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        {product.description ? (
                          <p className="mt-1 text-sm text-slate-600">
                            {product.description}
                          </p>
                        ) : null}
                        {product.imageUrl ? (
                          <a
                            href={product.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs text-violet-700 underline"
                          >
                            View image
                          </a>
                        ) : null}

                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProductId(product._id);
                              setEditingDraft({
                                name: product.name,
                                description: product.description ?? "",
                                price: Number(product.price ?? 0),
                                stock: Number(product.stock ?? 0),
                                category: product.category ?? "GENERAL",
                                imageUrl: product.imageUrl ?? "",
                                isActive: Boolean(product.isActive),
                              });
                            }}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProduct(product._id)}
                            className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-violet-700" />
          <h2 className="text-lg font-semibold text-slate-900">Manage Orders</h2>
        </div>

        {isLoadingOrders ? (
          <p className="text-sm text-slate-600">Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-600">No orders yet.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const orderDate = order.createdAt
                ? new Date(order.createdAt).toLocaleString()
                : "-";
              const orderStatusOptions =
                role === "ADMIN"
                  ? allOrderStatuses
                  : shopEditableOrderStatuses.includes(order.status)
                    ? shopEditableOrderStatuses
                    : [order.status, ...shopEditableOrderStatuses];
              return (
                <article
                  key={order._id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Order #{order._id.slice(-8).toUpperCase()}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Buyer: {order.userId?.name ?? "-"} ({order.userId?.email ?? "-"})
                      </p>
                      <p className="text-xs text-slate-500">Placed: {orderDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        ₹{Number(order.total ?? 0).toFixed(2)}
                      </p>
                      <select
                        value={order.status}
                        onChange={(event) =>
                          onChangeOrderStatus(order._id, event.target.value)
                        }
                        disabled={updatingOrderId === order._id}
                        className="mt-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                      >
                        {orderStatusOptions.map((statusOption) => (
                          <option
                            key={statusOption}
                            value={statusOption}
                            disabled={role !== "ADMIN" && statusOption === "PENDING"}
                          >
                            {statusOption}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    {order.items.map((item, index) => (
                      <p key={item._id ?? `${order._id}-${index}`}>
                        {item.name} x {item.quantity} = ₹
                        {(Number(item.price) * Number(item.quantity)).toFixed(2)}
                      </p>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
