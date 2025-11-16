"use client";
import { useCallback, useEffect, useState } from "react";
import { useLocalToken } from "../../useLocalToken";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

type Review = {
  id: string;
  jobId: string;
  raterUserId: string;
  rateeUserId: string;
  stars: number;
  comment: string | null;
  createdAt: string;
  job?: {
    id: string;
    title: string | null;
  };
  rater?: {
    id: string;
    email: string | null;
    profile?: { firstName: string | null; lastName: string | null } | null;
  };
  ratee?: {
    id: string;
    email: string | null;
    profile?: { firstName: string | null; lastName: string | null } | null;
  };
};

const formatName = (user?: {
  email: string | null;
  profile?: { firstName: string | null; lastName: string | null } | null;
}) => {
  if (!user) return "—";
  const first = user.profile?.firstName;
  const last = user.profile?.lastName;
  const full = [first, last].filter(Boolean).join(" ");
  return full || user.email || "—";
};

const StarRating = ({ stars }: { stars: number }) => (
  <div className="flex gap-4">
    {[1, 2, 3, 4, 5].map((s) => (
      <span
        key={s}
        className={s <= stars ? "text-yellow-500" : "text-gray-300"}
      >
        ★
      </span>
    ))}
  </div>
);

export default function AdminReviewsPage() {
  const [token] = useLocalToken();
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);

  const loadReviews = useCallback(async () => {
    if (!userId) {
      setReviews([]);
      setStatus("Enter user ID to view reviews");
      return;
    }
    setStatus("Loading...");
    try {
      const res = await fetch(`${API}/reviews/users/${userId}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setStatus(`Error ${res.status}`);
        setReviews([]);
        return;
      }
      setReviews(Array.isArray(data) ? data : []);
      setStatus(`Loaded ${Array.isArray(data) ? data.length : 0} reviews`);
    } catch (err) {
      console.error(err);
      setStatus("Network error");
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadReviews();
    }
  }, [userId, loadReviews]);

  return (
    <div className="container">
      <h2>Review Management</h2>
      <p className="text-muted font-13">
        View reviews for any user (provider or customer).
      </p>

      <div className="flex gap-8 items-center mt-8">
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Enter user ID"
        />
        <button onClick={loadReviews}>Load Reviews</button>
        <span className="font-12 text-muted">{status}</span>
      </div>

      <div className="mt-16 grid gap-12">
        {reviews.length === 0 && (
          <div className="text-muted">No reviews found.</div>
        )}
        {reviews.map((review) => (
          <div key={review.id} className="card">
            <div className="flex justify-between gap-12">
              <div className="flex-1">
                <div className="flex items-center gap-8 mb-4">
                  <StarRating stars={review.stars} />
                  <span className="font-semibold">{review.stars}/5</span>
                </div>
                <div className="font-13 text-muted mb-4">
                  Job: {review.job?.title || "Unknown"}
                </div>
                {review.comment && (
                  <div className="font-14 mb-4">
                    &quot;{review.comment}&quot;
                  </div>
                )}
                <div className="font-12 text-muted">
                  <div>From: {formatName(review.rater)}</div>
                  <div>To: {formatName(review.ratee)}</div>
                  <div>Date: {new Date(review.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="text-right font-12 text-muted">
                <div>Review ID: {review.id}</div>
                <div>Job ID: {review.jobId}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
