
/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  async headers() {
    return [
      {
        // Enable SharedArrayBuffer for DinoPlay pages (required by FFmpeg.wasm)
        // Using 'credentialless' COEP so YouTube iframes and CDN resources still load
        source: '/tools/dinoplay/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    config.resolve.alias['util-deprecate'] = path.resolve(
      __dirname,
      'webpack-shims/util-deprecate.js'
    );

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    config.externals.push({
      'onnxruntime-node': 'commonjs onnxruntime-node',
    });

    return config;
  },
};

module.exports = nextConfig;

