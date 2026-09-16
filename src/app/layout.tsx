import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Call Quality Assurance Platform",
  description:
    "Enterprise AI platform that automatically audits customer-service calls against official QA scorecards with transparent evidence detection and deterministic scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="min-h-full flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
