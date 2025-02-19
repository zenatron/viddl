/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['your-domain.com'], // Add your domains here
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ]
  },
  // Add this to allow fetching from your domains
  async rewrites() {
    return [
      {
        source: '/video-proxy/:path*',
        destination: 'https://your-domain.com/:path*',
      },
    ]
  }
}

module.exports = nextConfig 