import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canoas Empreende | Observatório",
  description: "Protótipo do observatório de desenvolvimento econômico e WebGIS de Canoas/RS. Dados demonstrativos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className="min-h-screen bg-background text-foreground antialiased">{children}</body></html>;
}
