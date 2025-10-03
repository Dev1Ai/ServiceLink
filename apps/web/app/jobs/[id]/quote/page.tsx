import QuoteFormClient from './QuoteFormClient';

export default async function QuoteFormPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <QuoteFormClient params={resolvedParams} />;
}
