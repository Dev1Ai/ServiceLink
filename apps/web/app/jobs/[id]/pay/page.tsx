'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '../../../components/payments/CheckoutForm';
import { useFetch } from '../../../useLocalToken';

// Make sure to put your publishable key here
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export default function PayForJobPage() {
  const params = useParams();
  const jobId = params.id as string;
  const { fetchAPI } = useFetch();
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!jobId) return;

    const createPaymentIntent = async () => {
      setError('');
      try {
        // In a real app, the amount should not be hardcoded.
        // It should be fetched from the job details.
        const amount = 10000; // e.g., $100.00

        const response = await fetchAPI(`/payments/jobs/${jobId}/intent`, {
          method: 'POST',
          body: JSON.stringify({ amount }),
        });

        if (!response.ok) {
          const res = await response.json();
          throw new Error(res.message || 'Failed to create payment intent.');
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (err: any) {
        setError(err.message);
      }
    };

    createPaymentIntent();
  }, [jobId, fetchAPI]);

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <div className="container mx-auto p-4 text-red-500">
        Stripe publishable key is not set. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your environment.
      </div>
    );
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-500">Error: {error}</div>;
  }

  if (!clientSecret) {
    return <div className="container mx-auto p-4">Loading payment form...</div>;
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
    },
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Pay for Job {jobId}</h1>
      <Elements options={options} stripe={stripePromise}>
        <CheckoutForm />
      </Elements>
    </div>
  );
}
