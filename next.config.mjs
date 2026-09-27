// Plain ESM (not next.config.ts) so `next start` in production never needs the `typescript` devDependency.
// Production runs `next start` (see Dockerfile); `output: "standalone"` was removed because
// `next start` does not support it and nothing consumed .next/standalone.

/** @type {import("next").NextConfig} */
const nextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
