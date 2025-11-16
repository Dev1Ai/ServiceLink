import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ServiceLink — Marketing",
    short_name: "ServiceLink",
    description: "Find trusted local providers for home services.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b5fff",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
