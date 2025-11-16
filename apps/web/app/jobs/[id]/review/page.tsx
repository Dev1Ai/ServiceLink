'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFetch } from '../../useLocalToken'; // Assuming a custom hook for authenticated fetch

export default function ReviewPage() {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const params = useParams();
  const router = useRouter();
  const { fetchAPI } = useFetch();

  const jobId = params.id as string;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!jobId) {
      setError('Job ID is missing.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetchAPI(`/reviews/jobs/${jobId}`, {
        method: 'POST',
        body: JSON.stringify({ stars, comment }),
      });

      if (!response.ok) {
        const res = await response.json();
        throw new Error(res.message || 'Failed to submit review.');
      }

      // Redirect to the job page or a confirmation page
      router.push(`/jobs/${jobId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Leave a Review for Job {jobId}</h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div>
          <label htmlFor="stars" className="block text-sm font-medium text-gray-700">
            Rating (1-5)
          </label>
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setStars(star)}
                className={`text-2xl ${star <= stars ? 'text-yellow-400' : 'text-gray-300'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
            Comment
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="How was your experience?"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </form>
    </div>
  );
}
