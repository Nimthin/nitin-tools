import ToolCard from '@/components/ToolCard';

const tools = [
  {
    title: 'PDF Page Remover',
    description: 'Upload a PDF, select the pages you want to remove, and download a clean copy. Fast, private — processed entirely in your browser.',
    icon: '📄',
    href: '/tools/pdf-page-remover',
  },
  {
    title: 'YouTube to MP3',
    description: 'Download audio from any YouTube video directly as an MP3. Choose your quality — up to 320 kbps.',
    icon: '🎵',
    href: '/tools/youtube-audio',
  },
  // Add more tools here
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-badge">
          <span className="hero-badge-dot"></span>
          All tools run locally in your browser
        </div>
        <h1>
          Your Personal<br />
          <span className="hero-gradient-text">Toolkit</span>
        </h1>
        <p>
          Small, fast utility tools that handle everyday tasks.
          No uploads to servers, no sign-ups, no nonsense.
        </p>
      </section>

      <section className="tools-section">
        <h2 className="tools-section-title">Available Tools</h2>
        <div className="tools-grid">
          {tools.map((tool, index) => (
            <ToolCard key={tool.href} {...tool} index={index} />
          ))}
        </div>
      </section>
    </>
  );
}
