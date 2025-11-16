import QuoteFormClient from './QuoteFormClient';

export async function generateStaticParams() {
  return [{ id: 'example-static' }];
}

export default async function QuoteFormPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <QuoteFormClient params={resolvedParams} />;
}
