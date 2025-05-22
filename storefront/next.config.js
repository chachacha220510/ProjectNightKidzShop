/** @type {import('next').NextConfig} */

const { withStoreConfig } = require("./store-config");
const features = require("./store.config.json");
const checkEnvVariables = require("./check-env-variables");

checkEnvVariables();

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
    ],
    deviceSizes: [640, 768, 1024, 1280, 1536],
  },
  transpilePackages: [
    "@medusajs/ui",
    "@medusajs/product",
    "@medusajs/modules-sdk",
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  staticPageGenerationTimeout: 300,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate, s-maxage=60",
          },
          {
            key: "Vary",
            value: "Cookie, Authorization",
          },
        ],
      },
    ];
  },
};

module.exports = withStoreConfig({ ...nextConfig, features });
