/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { dev }) {
    config.experiments = {
      syncWebAssembly: true,
      layers: true
    }
    return config
  }
}

module.exports = nextConfig
