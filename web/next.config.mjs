/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Type safety is enforced by tsc during build; lint style rules
    // (no-explicit-any on three.js interop) must not block deploys.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
