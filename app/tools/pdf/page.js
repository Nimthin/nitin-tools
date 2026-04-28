import Link from 'next/link';
import ToolCard from '@/components/ToolCard';

const pdfTools = [
  {
    title: 'PDF Page Remover',
    description: 'Upload a PDF, select the pages you want to remove, and download a clean copy.',
    icon: '✂️',
    href: '/tools/pdf/page-remover',
  },
  {
    title: 'Image to PDF',
    description: 'Select multiple images, rearrange them, and convert them into a single PDF document.',
    icon: '🖼️',
    href: '/tools/pdf/image-to-pdf',
  },
  {
    title: 'PDF Merger',
    description: 'Combine multiple PDF files into one. Drag and drop to rearrange their order before merging.',
    icon: '🔗',
    href: '/tools/pdf/pdf-merger',
  }
];

export default function PdfToolkitHub() {
  return (
    <div className="tool-page">
      <Link href="/" className="tool-page-back">
        ← Back to Home
      </Link>

      <div className="tool-page-header">
        <h1>📄 PDF Toolkit</h1>
        <p>
          A collection of privacy-first PDF utilities. All processing happens entirely within your browser — no files are ever uploaded to a server.
        </p>
      </div>

      <section className="tools-section" style={{ padding: '2rem 0' }}>
        <div className="tools-grid">
          {pdfTools.map((tool, index) => (
            <ToolCard key={tool.href} {...tool} index={index} />
          ))}
        </div>
      </section>
    </div>
  );
}
