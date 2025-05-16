const checkEnvVariables = require("./check-env-variables")
checkEnvVariables()

// 预处理 hostnames，避免 undefined 报错
const minioHost = process.env.NEXT_PUBLIC_MINIO_ENDPOINT?.replace(/^https?:\/\//, '')
const medusaHost = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL?.replace(/^https?:\/\//, '')
const baseUrlHost = process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, '')

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      ...(baseUrlHost ? [{
        protocol: process.env.NEXT_PUBLIC_BASE_URL?.startsWith('https') ? 'https' : 'http',
        hostname: baseUrlHost,
      }] : []),
      ...(medusaHost ? [{
        protocol: "https",
        hostname: medusaHost,
      }] : []),
      ...(minioHost ? [{
        protocol: "https",
        hostname: minioHost,
      }] : []),
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
  },
  serverRuntimeConfig: {
    port: process.env.PORT || 3000,
  },
}

module.exports = nextConfig
