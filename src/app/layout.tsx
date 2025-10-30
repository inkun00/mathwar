'use client';

import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection } from "firebase/firestore";

// Metadata cannot be defined in a client component.
// We will move this to a server component if needed, or define it statically.
// export const metadata: Metadata = {
//   title: '수학 전쟁',
//   description: '소수 배우기 게임',
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <title>수학 전쟁</title>
        <meta name="description" content="소수 배우기 게임" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
            {children}
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
