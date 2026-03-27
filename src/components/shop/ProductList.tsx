"use client";

import { useEffect, useState } from "react";

export default function ProductList({ userId }: any) {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then(setProducts);
  }, []);

  const addToCart = async (id: string) => {
    await fetch("/api/cart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, productId: id }),
    });
  };

  return (
    <div>
      <h2>Products</h2>
      {products.map((p) => (
        <div key={p._id}>
          {p.name} - ₹{p.price}
          <button onClick={() => addToCart(p._id)}>
            Add to Cart
          </button>
        </div>
      ))}
    </div>
  );
}