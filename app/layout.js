import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import DynamicBackground from '@/components/DynamicBackground';

export const metadata = {
  title: 'DinoTools — Retro Utility Toolkit 🦕',
  description: 'A collection of free, fast, and private utility tools built for personal use. Process files, convert data, and automate small tasks — all in your browser.',
};

export default function RootLayout({ children }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_dGVzdC1rZXktMTIuY2xlcmsuYWNjb3VudHMuZGV2JA';

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={{
        elements: {
          footer: { display: "none" },
          footerAction: { display: "none" },
        },
        layout: {
          showOptionalFields: false,
        }
      }}
    >
      <html lang="en">
        <body>
          <DynamicBackground />
          <main>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
