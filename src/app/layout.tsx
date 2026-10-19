import type { Metadata } from "next";
import {SiteShell} from "@/components/site-shell";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "Canoas Empreende | Observatório Econômico",
  description: "Indicadores oficiais IBGE e Dados RS de empresas e desenvolvimento econômico de Canoas/RS.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className="min-h-screen bg-background text-foreground antialiased"><SiteShell>{children}</SiteShell></body></html>;
}