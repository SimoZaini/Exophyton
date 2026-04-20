/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["yahoo-finance2", "@prisma/client", "bcryptjs"],
  },
};

export default nextConfig;
