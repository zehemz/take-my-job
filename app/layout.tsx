import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kobani",
  description: "Kanban-driven agent orchestration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
