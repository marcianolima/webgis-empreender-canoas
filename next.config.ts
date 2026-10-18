import type { NextConfig } from "next";
const basePath = process.env.GITHUB_ACTIONS === "true" ? "/webgis-empreender-canoas" : "";
const config: NextConfig = {
  output: "export", trailingSlash: true, basePath,
  reactStrictMode: true, poweredByHeader: false,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};
export default config;
