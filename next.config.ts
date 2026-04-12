import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // three.js and react-globe.gl ship as ES modules — Next.js needs to transpile them
  transpilePackages: ['three', 'three-globe', 'react-globe.gl'],
};

export default nextConfig;
