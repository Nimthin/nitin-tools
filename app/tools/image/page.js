import Link from 'next/link';
import ToolCard from '@/components/ToolCard';

const imageTools = [
  {
    title: 'Background Remover',
    description: 'Instantly strip the background from any image using local in-browser AI processing.',
    icon: '✨',
    href: '/tools/image/background-remover',
  },
  {
    title: 'Image to Text (OCR)',
    description: 'Upload an image and instantly extract all text from it using advanced optical character recognition.',
    icon: '📝',
    href: '/tools/image/image-to-text',
  }
];

export default function ImageToolkitHub() {
  return (
    <div className="tool-page">
      <Link href="/" className="tool-page-back">
        ← Back to Home
      </Link>

      <div className="tool-page-header">
        <h1>🖼️ Image Toolkit</h1>
        <p>
          A collection of advanced image utilities. All processing happens entirely within your browser — no images are ever uploaded to a server.
        </p>
      </div>

      <section className="tools-section" style={{ padding: '2rem 0' }}>
        <div className="tools-grid">
          {imageTools.map((tool, index) => (
            <ToolCard key={tool.href} {...tool} index={index} />
          ))}
        </div>
      </section>
    </div>
  );
}
