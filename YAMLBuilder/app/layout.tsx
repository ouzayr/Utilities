import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visual YAML Builder",
  description: "Drag-and-drop GUI for creating and visualizing YAML files",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
