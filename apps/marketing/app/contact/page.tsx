export default function ContactPage() {
  const endpoint = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;
  return (
    <div>
      <h2>Contact</h2>
      {endpoint ? (
        <form method="post" action={endpoint} aria-label="Contact form">
          <div>
            <label htmlFor="name">Name</label>
            <br />
            <input id="name" name="name" required />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <br />
            <input id="email" type="email" name="email" required />
          </div>
          <div>
            <label htmlFor="message">Message</label>
            <br />
            <textarea id="message" name="message" rows={5} required />
          </div>
          <button type="submit">Send</button>
        </form>
      ) : (
        <>
          <p>
            We’d love to hear from you. For general inquiries, email us at{" "}
            <a href="mailto:support@example.com">support@example.com</a>.
          </p>
          <p>
            For providers interested in joining, email{" "}
            <a href="mailto:providers@example.com">providers@example.com</a>.
          </p>
        </>
      )}
      <p>Follow us on social media (coming soon).</p>
    </div>
  );
}
