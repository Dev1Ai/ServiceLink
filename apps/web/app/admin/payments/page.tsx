'use client';

import { useEffect, useState } from 'react';
import { useFetch } from '../../useLocalToken';

interface Payment {
  id: string;
  jobId: string;
  amount: number;
  status: string;
  currency: string;
  stripePaymentIntentId: string | null;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { fetchAPI } = useFetch();

  useEffect(() => {
    const fetchPayments = async () => {
      setIsLoading(true);
      setError('');
      try {
        // Note: The backend does not have a GET /payments endpoint yet.
        // This is a placeholder for where that would be called.
        // For now, we will use mock data.
        // const response = await fetchAPI('/payments');
        // if (!response.ok) {
        //   throw new Error('Failed to fetch payments.');
        // }
        // const data = await response.json();
        const mockData: Payment[] = [
          { id: 'pay_1', jobId: 'job_1', amount: 10000, status: 'succeeded', currency: 'usd', stripePaymentIntentId: 'pi_1' },
          { id: 'pay_2', jobId: 'job_2', amount: 5000, status: 'requires_capture', currency: 'usd', stripePaymentIntentId: 'pi_2' },
          { id: 'pay_3', jobId: 'job_3', amount: 7500, status: 'succeeded', currency: 'usd', stripePaymentIntentId: 'pi_3' },
        ];
        setPayments(mockData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayments();
  }, [fetchAPI]);

  const handleRefund = async (paymentId: string, amount: number) => {
    if (!window.confirm('Are you sure you want to refund this payment?')) {
      return;
    }
    
    try {
      const response = await fetchAPI(`/payments/${paymentId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ amount }), // Full refund
      });
      if (!response.ok) {
        const res = await response.json();
        throw new Error(res.message || 'Refund failed');
      }
      alert('Refund processed successfully!');
      // Refetch payments to update status
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (isLoading) {
    return <div className="container mx-auto p-4">Loading payments...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin - Manage Payments</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{payment.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{payment.jobId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {(payment.amount / 100).toLocaleString('en-US', { style: 'currency', currency: payment.currency })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    payment.status === 'succeeded' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {payment.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {payment.status === 'succeeded' && (
                    <button
                      onClick={() => handleRefund(payment.id, payment.amount)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Refund
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}