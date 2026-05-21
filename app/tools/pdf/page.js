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
  },
  {
    title: 'Compress PDF',
    description: 'Reduce the file size of your PDFs while maintaining quality.',
    icon: '🗜️',
    href: '/tools/pdf/compress',
  },
  {
    title: 'Edit PDF',
    description: 'Add text, annotations, and shapes directly onto your PDF pages.',
    icon: '✍️',
    href: '/tools/pdf/edit',
  },
  {
    title: 'Watermark PDF',
    description: 'Stamp custom text or image watermarks across your PDF document.',
    icon: '©️',
    href: '/tools/pdf/watermark',
  },
  {
    title: 'Unlock PDF',
    description: 'Remove password protection from your PDFs permanently.',
    icon: '🔓',
    href: '/tools/pdf/protect',
  },
  {
    title: 'Summarize PDF',
    description: 'Extract key points and get a concise summary of your document using AI.',
    icon: '🤖',
    href: '/tools/pdf/summarize',
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
        <p>Private, in-browser PDF utilities.</p>
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
