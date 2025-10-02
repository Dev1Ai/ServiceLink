import QuotesPageClient from './QuotesPageClient';

export async function generateStaticParams() {
  return [{ id: 'example-static' }];
}

export default function QuotesPage({ params }: { params: { id: string } }) {
  return <QuotesPageClient params={params} />;
}
