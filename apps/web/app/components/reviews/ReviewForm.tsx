"use client";
import { useState } from "react";
import { useToast } from "../Toast";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export function ReviewForm({
  jobId,
  token,
  onSuccess,
}: {
  jobId: string;
  token: string;
  onSuccess?: () => void;
}) {
  const { push } = useToast();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      push("Please provide a JWT token", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/reviews/jobs/${jobId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stars, comment: comment || undefined }),
      });

      if (res.ok) {
        push("Review submitted successfully", "success");
        setComment("");
        setStars(5);
        onSuccess?.();
      } else {
        const text = await res.text().catch(() => "");
        push(`Failed to submit review (${res.status}): ${text}`, "error");
      }
    } catch (err) {
      console.error(err);
      push("Network error while submitting review", "error");
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={submit} className="card">
      <h3>Submit a Review</h3>
      <div className="mt-8">
        <label className="font-13 text-muted">Rating</label>
        <div className="flex gap-8 mt-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStars(s)}
              className={`font-24 ${s <= stars ? "text-yellow-500" : "text-gray-300"}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <div className="mt-12">
        <label className="font-13 text-muted">Comment (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience..."
          className="mt-4"
          rows={4}
        />
      </div>
      <button type="submit" disabled={submitting} className="mt-12">
        {submitting ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}
