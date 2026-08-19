import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chrome on this machine resolves `localhost` unreliably, so the app also
  // gets opened on 127.0.0.1. Next treats that as a different origin and
  // blocks its dev resources, which silently breaks hydration -- allow both.
  // Development only; it has no effect on a production build.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  experimental: {
    serverActions: {
      // Photos are downscaled in the browser before posting, so a normal entry
      // lands well under 1 MB. This raised ceiling is the safety net for the
      // no-JavaScript path, where the original file is posted as-is. Kept
      // under the 4.5 MB request cap most hosts enforce on serverless
      // functions, since a higher value here could not be honoured anyway.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
