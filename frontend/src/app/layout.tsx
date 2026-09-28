import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAPP PATH Tracker",
  description: "Analyze PATH ride history and recommend the best fare plan",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en suppressHydrationWarning">
      <body>{children}</body>
    </html>
  );
}
