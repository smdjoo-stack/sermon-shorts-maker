/** @type {import('next').NextConfig} */
const nextConfig = {
  // ffmpeg-static / ffprobe-static / yt-dlp-wrap ship native binaries.
  // Keep them external so Next doesn't try to bundle the .exe files.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static", "yt-dlp-wrap"],
};

export default nextConfig;
