'use client';

import { useState, useEffect } from 'react';

interface Payment {
  id: string;
  jobId: string;
  amount: number;
  currency: string;
  status: string;
  stripePaymentIntentId?: string;
}

export default function RefundsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundAmount, setRefundAmount] = useState<{ [key: string]: string }>({});
  const [refundReason, setRefundReason] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/payments`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPayments(data);
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (paymentId: string) => {
    const amount = refundAmount[paymentId] ? parseInt(refundAmount[paymentId]) : undefined;
    const reason = refundReason[paymentId];

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/payments/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          paymentId,
          amount,
          reason,
        }),
      });

      if (response.ok) {
        alert('Refund processed successfully');
        fetchPayments();
      } else {
        const error = await response.json();
        alert(`Refund failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to process refund:', error);
      alert('Failed to process refund');
    }
  };

  if (loading) {
    return <div className="p-6">Loading payments...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Payment Refunds</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stripe ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{payment.jobId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  ${(payment.amount / 100).toFixed(2)} {payment.currency.toUpperCase()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      payment.status === 'succeeded'
                        ? 'bg-green-100 text-green-800'
                        : payment.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {payment.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-xs">
                  {payment.stripePaymentIntentId || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {payment.status === 'succeeded' && (
                    <div className="space-y-2">
                      <input
                        type="number"
                        placeholder="Amount (cents)"
                        value={refundAmount[payment.id] || ''}
                        onChange={(e) =>
                          setRefundAmount({ ...refundAmount, [payment.id]: e.target.value })
                        }
                        className="w-32 px-2 py-1 border rounded text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Reason"
                        value={refundReason[payment.id] || ''}
                        onChange={(e) =>
                          setRefundReason({ ...refundReason, [payment.id]: e.target.value })
                        }
                        className="w-48 px-2 py-1 border rounded text-sm"
                      />
                      <button
                        onClick={() => handleRefund(payment.id)}
                        className="ml-2 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        Refund
                      </button>
                    </div>
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
