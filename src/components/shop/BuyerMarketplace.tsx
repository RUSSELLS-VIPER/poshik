"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
} from "lucide-react";

type ProductItem = {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  price: number;
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

type SortBy = "featured" | "price-asc" | "price-desc" | "name-asc" | "newest";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const FREE_SHIPPING_THRESHOLD = 1200;

function toSentenceCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function truncateText(value?: string, maxLength = 96): string {
  if (!value) {
    return "Carefully selected essentials for your pet's daily needs.";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export default function BuyerMarketplace() {
  const { data: session, status } = useSession();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [cart, setCart] = useState<CartData>({ items: [] });
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingCart, setIsLoadingCart] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [sortBy, setSortBy] = useState<SortBy>("featured");
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeProduct, setActiveProduct] = useState<ProductItem | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const cartItemCount = useMemo(
    () => cart.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
    [cart.items]
  );

  const cartSubtotal = useMemo(
    () =>
      cart.items.reduce(
        (sum, item) =>
          sum + Number(item.productId?.price ?? 0) * Number(item.quantity ?? 0),
        0
      ),
    [cart.items]
  );

  const categoryStats = useMemo(() => {
    const counts = new Map<string, number>();

    products.forEach((product) => {
      const key = (product.category ?? "GENERAL").toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const values = Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

    return [{ category: "ALL", count: products.length }, ...values];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const text = search.trim().toLowerCase();

    const visibleByCategory = products.filter((product) => {
      const category = (product.category ?? "GENERAL").toUpperCase();
      if (selectedCategory === "ALL") {
        return true;
      }
      return category === selectedCategory;
    });

    const visibleBySearch = visibleByCategory.filter((product) => {
      if (!text) {
        return true;
      }

      const haystack = `${product.name} ${product.description ?? ""} ${
        product.category ?? ""
      }`.toLowerCase();
      return haystack.includes(text);
    });

    return [...visibleBySearch].sort((left, right) => {
      if (sortBy === "price-asc") {
        return Number(left.price ?? 0) - Number(right.price ?? 0);
      }

      if (sortBy === "price-desc") {
        return Number(right.price ?? 0) - Number(left.price ?? 0);
      }

      if (sortBy === "name-asc") {
        return left.name.localeCompare(right.name);
      }

      if (sortBy === "newest") {
        return right._id.localeCompare(left._id);
      }

      const leftStock = Number(left.stock ?? 0);
      const rightStock = Number(right.stock ?? 0);
      return rightStock - leftStock;
    });
  }, [products, search, selectedCategory, sortBy]);

  const featuredProducts = useMemo(() => filteredProducts.slice(0, 4), [filteredProducts]);

  const freeShippingProgress = Math.min(
    100,
    (cartSubtotal / FREE_SHIPPING_THRESHOLD) * 100
  );

  const amountForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - cartSubtotal);

  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const response = await fetch("/api/products", {
        cache: "no-store",
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not fetch products.");
      }

      const list = Array.isArray(responseData) ? responseData : [];
      setProducts(list);

      setQuantities((previous) => {
        const next = { ...previous };
        list.forEach((product) => {
          if (!next[product._id]) {
            next[product._id] = 1;
          }
        });
        return next;
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not fetch products.",
      });
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  const loadCart = useCallback(async () => {
    if (!session) {
      setIsLoadingCart(false);
      return;
    }

    setIsLoadingCart(true);
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not fetch cart.");
      }
      setCart({
        items: Array.isArray(responseData?.items) ? responseData.items : [],
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Could not fetch cart.",
      });
    } finally {
      setIsLoadingCart(false);
    }
  }, [session]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    void loadProducts();
    void loadCart();
  }, [status, loadCart, loadProducts]);

  useEffect(() => {
    if (!activeProduct) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveProduct(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeProduct]);

  const updateQuantity = (productId: string, stock: number, delta: number) => {
    setQuantities((previous) => {
      const current = previous[productId] ?? 1;
      const nextValue = Math.max(1, Math.min(stock, current + delta));
      return {
        ...previous,
        [productId]: nextValue,
      };
    });
  };

  const addToCart = async (productId: string) => {
    if (!session) {
      setFeedback({
        type: "error",
        message: "Please login first to add products to cart.",
      });
      return;
    }

    const quantity = Math.max(1, Number(quantities[productId] ?? 1));

    setFeedback(null);
    setBusyProductId(productId);
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not add to cart.");
      }

      setCart({
        items: Array.isArray(responseData?.items) ? responseData.items : [],
      });
      setFeedback({
        type: "success",
        message: quantity > 1 ? `${quantity} items added to cart.` : "Product added to cart.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Could not add to cart.",
      });
    } finally {
      setBusyProductId(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading shop...
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-800 p-6 text-white shadow-2xl sm:p-8">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-black/15 to-transparent" />

        <div className="relative grid gap-6 lg:grid-cols-[1.25fr,0.75fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-100">
              Pet Shop
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              Everything your pet needs in one place
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-teal-100/90 sm:text-base">
              Discover premium food, grooming items, toys, and wellness products
              curated for happy, healthy pets.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium">
                Same-day dispatch
              </span>
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium">
                Trusted sellers
              </span>
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium">
                Easy checkout
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.16em] text-teal-100">
              Cart Snapshot
            </p>
            <p className="mt-2 text-2xl font-bold">{cartItemCount} items</p>
            <p className="text-sm text-teal-100/90">
              {CURRENCY_FORMATTER.format(cartSubtotal)} subtotal
            </p>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-lime-300 transition-all"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-teal-100/90">
              {amountForFreeShipping > 0
                ? `Add ${CURRENCY_FORMATTER.format(
                    amountForFreeShipping
                  )} more for free shipping.`
                : "Free shipping unlocked."}
            </p>

            <Link
              href="/owner/shop/cart"
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-teal-900 transition hover:bg-teal-50"
            >
              Go to Checkout
            </Link>
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search food, toys, grooming products..."
              className="w-full rounded-xl border border-slate-300 px-9 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            />
          </label>

          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Sort
            </p>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortBy)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {categoryStats.map((entry) => {
            const active = entry.category === selectedCategory;
            return (
              <button
                key={entry.category}
                type="button"
                onClick={() => setSelectedCategory(entry.category)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-teal-500 bg-teal-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-700"
                }`}
              >
                {entry.category === "ALL" ? "All Products" : toSentenceCase(entry.category)} (
                {entry.count})
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr,330px]">
        <section className="space-y-5">
          {isLoadingProducts ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading products...
              </span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              No products found for this filter. Try another category or search
              keyword.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => {
                const quantity = quantities[product._id] ?? 1;
                const stock = Number(product.stock ?? 0);
                const outOfStock = stock < 1;
                const lowStock = !outOfStock && stock <= 5;
                const regularPrice = Number(product.price ?? 0) * 1.18;

                return (
                  <article
                    key={product._id}
                    onClick={() => setActiveProduct(product)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveProduct(product);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${product.name}`}
                    className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    <div className="relative overflow-hidden bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.imageUrl || "/images/default-pet.png"}
                        alt={product.name}
                        className="h-48 w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        {toSentenceCase((product.category ?? "GENERAL").replaceAll("_", " "))}
                      </span>
                      {lowStock ? (
                        <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-amber-950">
                          Low stock
                        </span>
                      ) : null}
                      {outOfStock ? (
                        <span className="absolute right-2 top-2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Out of stock
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            {product.name}
                          </h3>
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-500">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <span className="ml-1 text-slate-500">(Top rated)</span>
                          </div>
                        </div>
                        <p className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                          Stock: {stock}
                        </p>
                      </div>

                      <p className="min-h-[40px] text-xs leading-5 text-slate-600">
                        {truncateText(product.description, 84)}
                      </p>

                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-base font-bold text-slate-900">
                            {CURRENCY_FORMATTER.format(Number(product.price ?? 0))}
                          </p>
                          <p className="text-xs text-slate-400 line-through">
                            {CURRENCY_FORMATTER.format(regularPrice)}
                          </p>
                        </div>

                        <div className="inline-flex items-center rounded-lg border border-slate-300">
                          <button
                            type="button"
                            disabled={outOfStock || quantity <= 1}
                            onClick={(event) => {
                              event.stopPropagation();
                              updateQuantity(product._id, stock, -1);
                            }}
                            className="rounded-l-lg px-2 py-1 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-8 px-2 text-center text-sm font-medium text-slate-800">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            disabled={outOfStock || quantity >= stock}
                            onClick={(event) => {
                              event.stopPropagation();
                              updateQuantity(product._id, stock, 1);
                            }}
                            className="rounded-r-lg px-2 py-1 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!session || busyProductId === product._id || outOfStock}
                        onClick={(event) => {
                          event.stopPropagation();
                          void addToCart(product._id);
                        }}
                        className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 px-3 py-2 text-sm font-semibold text-white transition hover:from-teal-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {busyProductId === product._id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Adding...
                          </>
                        ) : outOfStock ? (
                          "Out of stock"
                        ) : !session ? (
                          "Login to Add"
                        ) : (
                          <>
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Add to Cart
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveProduct(product);
                        }}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
                      >
                        View details
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:h-fit">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-semibold text-slate-900">Cart Summary</h2>
            </div>

            {isLoadingCart ? (
              <p className="text-sm text-slate-600">Loading cart...</p>
            ) : !session ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p>Login as pet owner to use cart and checkout.</p>
                <Link
                  href="/login"
                  className="mt-2 inline-block rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
                >
                  Go to Login
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-2 text-sm">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    Items: <span className="font-semibold">{cartItemCount}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    Subtotal:{" "}
                    <span className="font-semibold">
                      {CURRENCY_FORMATTER.format(cartSubtotal)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-teal-600 transition-all"
                    style={{ width: `${freeShippingProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {amountForFreeShipping > 0
                    ? `${CURRENCY_FORMATTER.format(
                        amountForFreeShipping
                      )} away from free shipping`
                    : "You have unlocked free shipping"}
                </p>

                <div className="mt-4 space-y-2">
                  <Link
                    href="/owner/shop/cart"
                    className="block w-full rounded-lg bg-gradient-to-r from-teal-700 to-cyan-700 px-3 py-2 text-center text-sm font-semibold text-white transition hover:from-teal-800 hover:to-cyan-800"
                  >
                    View Cart and Checkout
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      void loadProducts();
                      void loadCart();
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    Refresh Store
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Why buy here
            </h3>
            <div className="mt-3 space-y-3 text-sm text-slate-700">
              <div className="flex items-start gap-2">
                <Truck className="mt-0.5 h-4 w-4 text-teal-700" />
                <p>Fast dispatch on most pet essentials.</p>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-teal-700" />
                <p>Secure checkout with trusted sellers.</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-teal-700" />
                <p>Quality products selected for pet owners.</p>
              </div>
            </div>
          </section>

          {featuredProducts.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Trending Picks
              </h3>
              <div className="mt-3 space-y-3">
                {featuredProducts.map((product) => (
                  <div
                    key={`featured-${product._id}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                  >
                    <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      {toSentenceCase((product.category ?? "GENERAL").replaceAll("_", " "))}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-teal-700">
                      {CURRENCY_FORMATTER.format(Number(product.price ?? 0))}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      {activeProduct ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeProduct.name} details`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
          onClick={() => setActiveProduct(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid gap-6 p-5 sm:grid-cols-[1.1fr_1fr] sm:p-6">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeProduct.imageUrl || "/images/default-pet.png"}
                  alt={activeProduct.name}
                  className="h-60 w-full object-cover sm:h-full"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">
                    {toSentenceCase(
                      (activeProduct.category ?? "GENERAL").replaceAll("_", " ")
                    )}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {activeProduct.name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {activeProduct.description
                      ? activeProduct.description
                      : "Carefully selected essentials for your pet's daily needs."}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Price</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {CURRENCY_FORMATTER.format(Number(activeProduct.price ?? 0))}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Stock available: {Number(activeProduct.stock ?? 0)}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    Fast dispatch
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    Quality checked
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    Secure checkout
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    Easy returns
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setActiveProduct(null)}
                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveProduct(null);
                      void addToCart(activeProduct._id);
                    }}
                    disabled={!session || busyProductId === activeProduct._id}
                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 px-3 py-2 text-sm font-semibold text-white transition hover:from-teal-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {busyProductId === activeProduct._id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add to Cart"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
