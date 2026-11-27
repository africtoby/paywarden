import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PayWarden",
    short_name: "PayWarden",
    description: "Payroll your AI prepares. Only you can sign.",
    start_url: "/",
    display: "standalone",
    background_color: "#072019",
    theme_color: "#072019",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
  };
}
