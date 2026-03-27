"use client";

import { useEffect, useState } from "react";

export default function Cart({ userId }: any) {
  const [cart, setCart] = useState<any>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }

    fetch(`/api/cart?userId=${userId}`)
      .then((res) => res.json())
      .then(setCart);
  }, [userId]);

  const checkout = async () => {
    await fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
    alert("Order placed");
  };

  if (!cart) return <p>No cart</p>;

  return (
    <div>
      <h3>Cart</h3>
      {cart.items.map((i: any) => (
        <div key={i._id}>
          {i.productId.name} x {i.quantity}
        </div>
      ))}

      <button onClick={checkout}>Checkout</button>
    </div>
  );
}
