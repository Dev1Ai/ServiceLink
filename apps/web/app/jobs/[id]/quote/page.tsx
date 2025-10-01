import QuoteFormClient from './QuoteFormClient';

export async function generateStaticParams() {
  return [{ id: 'example-static' }];
}

export default function QuoteFormPage({ params }: { params: { id: string } }) {
  return <QuoteFormClient params={params} />;
}
