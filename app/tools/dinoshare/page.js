import Link from 'next/link';
import ToolCard from '@/components/ToolCard';
import PixelIcon from '@/components/PixelIcon';

const dinoShareTools = [
  {
    title: 'File Share',
    description: 'Upload files of any size and retrieve them on any other device using a 4-digit code.',
    icon: <PixelIcon type="share" size={32} />,
    href: '/tools/dinoshare/file',
  },
  {
    title: 'Text Clipboard',
    description: 'Paste text snippets, links, or code and access/copy them on any other device instantly.',
    icon: <PixelIcon type="notes" size={32} />,
    href: '/tools/dinoshare/text',
  }
];

export default function DinoShareHub() {
  return (
    <div className="tool-page">
      <Link href="/" className="tool-page-back">
        ← Back to Home
      </Link>

      <div className="tool-page-header">
        <h1>🦖 DinoShare Toolkit</h1>
        <p>Cross-device sharing utilities for files and text.</p>
      </div>

      <section className="tools-section" style={{ padding: '2rem 0' }}>
        <div className="tools-grid">
          {dinoShareTools.map((tool, index) => (
            <ToolCard key={tool.href} {...tool} index={index} />
          ))}
        </div>
      </section>
    </div>
  );
}
