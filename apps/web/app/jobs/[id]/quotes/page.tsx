import QuotesPageClient from './QuotesPageClient';

export default async function QuotesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <QuotesPageClient params={resolvedParams} />;
}
