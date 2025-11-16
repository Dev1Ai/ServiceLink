'use client';

import { useEffect, useState } from 'react';
import { useFetch } from '../../useLocalToken';

// Define the shape of a review
interface Review {
  id: string;
  stars: number;
  comment: string | null;
  createdAt: string;
  rater: {
    id: string;
    name: string;
  };
}

interface ReviewListProps {
  jobId: string;
}

export default function ReviewList({ jobId }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { fetchAPI } = useFetch();

  useEffect(() => {
    if (!jobId) return;

    const fetchReviews = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetchAPI(`/reviews?job_id=${jobId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch reviews.');
        }
        const data = await response.json();
        setReviews(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReviews();
  }, [jobId, fetchAPI]);

  if (isLoading) {
    return <div>Loading reviews...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (reviews.length === 0) {
    return <p>No reviews for this job yet.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Reviews</h2>
      <ul className="divide-y divide-gray-200">
        {reviews.map((review) => (
          <li key={review.id} className="py-4">
            <div className="flex space-x-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">{review.rater.name}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={`text-lg ${i < review.stars ? 'text-yellow-400' : 'text-gray-300'}`}>
                      ★
                    </span>
                  ))}
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-600">{review.comment}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}