import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@lumen-aid/shared",
    "@lumen-aid/merkle",
    "@lumen-aid/prover",
    "@lumen-aid/stellar"
  ]
};

export default nextConfig;
