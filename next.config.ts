import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Unsplash's guidelines require photos to be hotlinked from their CDN
    // rather than downloaded and re-served, so next/image has to be told the
    // host is allowed — without this the destination hero fails to load.
    // Narrow to the image CDN specifically; api.unsplash.com serves JSON, not
    // images, and should never appear in a src.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
