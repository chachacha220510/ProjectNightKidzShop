/**
 * @type {import("next").NextConfig}
 */
function getStoreConfig(config = {}) {
  return {
    features: config.features ?? {
      productModule: true,
      customerLogin: true,
      search: true,
    },
  };
}

function withStoreConfig(nextConfig = {}) {
  const storeConfig = getStoreConfig(nextConfig);

  return {
    ...nextConfig,
    env: {
      ...nextConfig.env,
      NEXT_PUBLIC_MEDUSA_STORE_CONFIG: JSON.stringify(storeConfig),
    },
  };
}

module.exports = { withStoreConfig };
