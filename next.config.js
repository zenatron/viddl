const path = require('path');

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
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ]
  },
  env: {
    YTDLP_PATH: process.env.NODE_ENV === 'production' 
      ? '/path/to/production/yt-dlp'
      : path.join(process.cwd(), 'bin', 'yt-dlp')
  }
}

module.exports = nextConfig 