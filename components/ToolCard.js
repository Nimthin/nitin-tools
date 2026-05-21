import Link from 'next/link';

export default function ToolCard({ title, description, icon, href, index = 0 }) {
  return (
    <Link 
      href={href} 
      className="tool-card staggered-card-entry"
      style={{ animationDelay: `${0.1 + (index * 0.1)}s` }}
    >
      <div className="tool-card-icon">{icon}</div>
      <div className="tool-card-content">
        <h3 className="tool-card-title">{title}</h3>
        <p className="tool-card-description">{description}</p>
      </div>
      <div className="tool-card-arrow">
        PLAY ▶
      </div>
    </Link>
  );
}
