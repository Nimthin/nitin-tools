import './globals.css';
import Header from '@/components/Header';
import ThemeProvider from '@/components/ThemeProvider';
import Chatbot from '@/components/Chatbot';

export const metadata = {
  title: 'Nitin Tools — Personal Utility Toolkit',
  description: 'A collection of free, fast, and private utility tools built for personal use. Process files, convert data, and automate small tasks — all in your browser.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Header />
          <main>{children}</main>
          <footer className="footer">
            Built with ❤️ for you
          </footer>
          <Chatbot />
        </ThemeProvider>
      </body>
    </html>
  );
}
