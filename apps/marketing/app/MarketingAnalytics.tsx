"use client";

export function MarketingAnalytics() {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <>
      {plausibleDomain && (
        <script
          defer
          data-domain={plausibleDomain}
          src="https://plausible.io/js/script.js"
        ></script>
      )}
      {gaId && <script defer data-ga-id={gaId} src="/ga.js"></script>}
    </>
  );
}
