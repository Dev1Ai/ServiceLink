export default function Page() {
  return (
    <div>
      <section className="hero" aria-labelledby="hero-heading">
        <h1 id="hero-heading" className="hero-title">Find trusted local providers for home services</h1>
        <p className="hero-subtitle">Simple to request, fast to quote, transparent to complete.</p>
        <a className="hero-cta" href="/about" aria-label="Learn more about ServiceLink">Learn more</a>
      </section>

      <section aria-labelledby="features-heading">
        <h2 id="features-heading">How it works</h2>
        <div className="grid-features">
          <div className="card">
            <h3>1. Post your job</h3>
            <p>Describe your project in seconds and share your location.</p>
          </div>
          <div className="card">
            <h3>2. Get quotes</h3>
            <p>Receive quotes from vetted providers and compare at a glance.</p>
          </div>
          <div className="card">
            <h3>3. Chat & schedule</h3>
            <p>Message providers in real time, schedule work, and track progress.</p>
          </div>
          <div className="card">
            <h3>4. Verify & pay</h3>
            <p>Mark completion and handle payment with confidence.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
