import ToolCard from '@/components/ToolCard';

const tools = [
  {
    title: 'Image Toolkit',
    description: 'A collection of image utilities: Remove backgrounds with AI, or extract text from any picture. Processed entirely and privately in your browser.',
    icon: '🖼️',
    href: '/tools/image',
  },
  {
    title: 'PDF Toolkit',
    description: 'A collection of PDF utilities: Remove pages, or convert multiple images into a single PDF document. All processed securely in your browser.',
    icon: '📄',
    href: '/tools/pdf',
  },
  {
    title: 'YouTube to MP3',
    description: 'Download audio from any YouTube video directly as an MP3. Choose your quality — up to 320 kbps.',
    icon: '🎵',
    href: '/tools/youtube-audio',
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1 className="hero-animated-title">
          <span className="hero-title-line">Your Personal</span>
          <br />
          <span className="hero-gradient-text">Toolkit</span>
        </h1>
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
