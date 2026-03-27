/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    // Work around intermittent .next cache corruption on this Windows setup.
    if (dev) {
      config.cache = false;
    }

    return config;
  },
};

module.exports = nextConfig;
