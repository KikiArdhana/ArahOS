import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ARAH", template: "%s · ARAH" },
  description: "Your Personal Life Operating System",
  applicationName: "ARAH",
};

export const viewport: Viewport = {
  themeColor: "#F6F6F3",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <Providers>
          <div className="mx-auto min-h-dvh w-full max-w-app">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
