import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PMO - Project Management Office',
  description: 'Comprehensive Project Management Office solution with 14 integrated tools',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50">
        {children}
      </body>
    </html>
  );
}
