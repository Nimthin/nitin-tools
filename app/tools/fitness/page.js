import Link from 'next/link';
import ToolCard from '@/components/ToolCard';

export const metadata = {
  title: 'Fitness Toolkit - NitinTools',
  description: 'Track your calories, macros, and fitness goals with in-browser tools.',
};

const fitnessTools = [
  {
    title: 'Calorie Counter',
    description: 'Look up calories, protein, carbs, fat, and fiber for 300+ foods. Build meals and track your daily intake.',
    icon: '🔥',
    href: '/tools/fitness/calorie-counter',
  },
];

export default function FitnessToolkitHub() {
  return (
    <div className="tool-page">
      <Link href="/" className="tool-page-back">
        ← Back to Home
      </Link>

      <div className="tool-page-header">
        <h1>💪 Fitness Toolkit</h1>
        <p>Track your nutrition and fitness goals, 100% in-browser.</p>
      </div>

      <section className="tools-section" style={{ padding: '2rem 0' }}>
        <div className="tools-grid">
          {fitnessTools.map((tool, index) => (
            <ToolCard key={tool.href} {...tool} index={index} />
          ))}
        </div>
      </section>
    </div>
  );
}
