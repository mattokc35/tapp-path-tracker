import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAPP PATH Tracker",
  description: "Analyze PATH ride history and recommend the best fare plan",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
