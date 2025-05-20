const checkEnvVariables = require("./check-env-variables")
checkEnvVariables()

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: [
      "localhost",
      "bucket-production-fe3b.up.railway.app",
      "backend-production-39d4.up.railway.app",
      "medusa-public-images.s3.eu-west-1.amazonaws.com",
      "medusa-server-testing.s3.amazonaws.com",
      "medusa-server-testing.s3.us-east-1.amazonaws.com",
      "medusa-public-images.s3.amazonaws.com",
    ],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "*.railway.app",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.us-east-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.eu-west-1.amazonaws.com",
      },
    ],
    unoptimized: process.env.NODE_ENV === "development",
    dangerouslyAllowSVG: true,
    formats: ["image/webp"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  serverRuntimeConfig: {
    port: process.env.PORT || 3000,
  },
  serverExternalPackages: [
    "medusa-interfaces",
    "@medusajs/medusa",
    "@medusajs/pricing",
    "@medusajs/tax",
    "apollo-server-errors",
    "driver-posgres",
  ],
}

module.exports = nextConfig
