import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import ClientLayoutWrapper from '@/components/ClientLayoutWrapper';

export const metadata = {
  title: 'DinoTools — Retro Utility Toolkit 🦕',
  description: 'A collection of free, fast, and private utility tools built for personal use. Process files, convert data, and automate small tasks — all in your browser.',
};

export default function RootLayout({ children }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_ZW5kbGVzcy1iaXNvbi02NS5jbGVyay5hY2NvdW50cy5kZXYk';

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
        <head>
          <script dangerouslySetInnerHTML={{ __html: `
            (function() {
              try {
                const savedTheme = localStorage.getItem('dino-theme');
                if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              } catch (e) {}
            })();
          ` }} />
        </head>
        <body>
          <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
        </body>
      </html>
    </ClerkProvider>
  );
}
