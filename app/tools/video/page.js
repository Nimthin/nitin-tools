import Link from 'next/link';
import PixelIcon from '@/components/PixelIcon';

export const metadata = {
  title: 'Video Toolkit - NitinTools',
  description: 'A collection of client-side video processing tools.',
};

const videoTools = [
  {
    title: 'Video to GIF',
    description: 'Trim, edit, and export video clips to GIF format locally in your browser.',
    icon: <PixelIcon type="video" size={32} />,
    href: '/tools/video/video-to-gif',
  },
  // We can add more video tools here later like "Video to Audio", "Video Compressor", etc.
];

export default function VideoToolkitPage() {
  return (
    <div className="tool-page">
      <Link href="/" className="tool-page-back">← Back to Home</Link>
      <div className="tool-page-header">
        <h1>🎞️ Video Toolkit</h1>
        <p>A collection of client-side video processing tools. Everything runs locally in your browser!</p>
      </div>

      <div className="tools-grid">
        {videoTools.map((tool) => (
          <Link href={tool.href} className="tool-card" key={tool.title}>
            <div className="tool-icon">{tool.icon}</div>
            <div className="tool-info">
              <h2>{tool.title}</h2>
              <p>{tool.description}</p>
            </div>
            <div className="tool-arrow">→</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
