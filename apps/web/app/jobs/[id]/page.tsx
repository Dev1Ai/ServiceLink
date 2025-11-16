'use client';

import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import ReviewList from '../../components/reviews/ReviewList';

// This is a placeholder for where you might fetch job details.
// In a real app, this would come from a custom hook or a data fetching library.
const useJobDetails = (jobId: string) => {
  // In a real implementation, you would fetch this data from your API
  if (!jobId) {
    return { job: null, isLoading: false, error: 'No Job ID provided' };
  }
  
  const mockJob = {
    id: jobId,
    title: `Job ${jobId}`,
    description: 'This is a detailed description of the job. The work was completed on...',
    status: 'Completed', // Assume job is completed to allow reviews
  };

  return { job: mockJob, isLoading: false, error: null };
};

export default function JobDetailsPage() {
  const params = useParams();
  const jobId = params.id as string;

  const { job, isLoading, error } = useJobDetails(jobId);

  if (isLoading) {
    return <div>Loading job details...</div>;
  }

  if (error || !job) {
    notFound();
  }

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h1 className="text-2xl font-bold leading-6 text-gray-900">{job.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Job ID: {job.id}</p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{job.description}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  {job.status}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-8">
        <ReviewList jobId={jobId} />
      </div>

      <div className="mt-8">
        <Link href={`/jobs/${jobId}/review`} className="text-indigo-600 hover:text-indigo-900">
          Leave a Review
        </Link>
      </div>
    </div>
  );
}
