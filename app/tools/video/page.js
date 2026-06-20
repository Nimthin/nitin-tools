import Link from 'next/link';
import PixelIcon from '@/components/PixelIcon';
import ToolCard from '@/components/ToolCard';

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
        {videoTools.map((tool, index) => (
          <ToolCard key={tool.title} {...tool} index={index} />
        ))}
      </div>
    </div>
  );
}

