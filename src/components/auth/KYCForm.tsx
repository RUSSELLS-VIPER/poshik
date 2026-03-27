"use client";

import { FormEvent, useState } from "react";

export default function KYCForm() {
  const [doc, setDoc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const submitKYC = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const documentUrl = doc.trim();
    if (!documentUrl) {
      setFeedback({ type: "error", message: "Document URL is required." });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentUrl }),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "KYC submission failed.");
      }

      setFeedback({
        type: "success",
        message: responseData?.message ?? "KYC submitted successfully.",
      });
      setDoc("");
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "KYC submission failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={submitKYC}>
      <input
        value={doc}
        placeholder="Document URL"
        onChange={(e) => setDoc(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Submitting..." : "Submit KYC"}
      </button>

      {feedback ? (
        <p
          className={`text-sm ${
            feedback.type === "success" ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}

