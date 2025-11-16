/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use static export only when explicitly enabled
  ...(process.env.NEXT_OUTPUT === "export" ? { output: "export" } : {}),
  reactStrictMode: true,
};
export default nextConfig;
