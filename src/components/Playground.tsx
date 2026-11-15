import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
export function ServiceOverview({ title = 'AWS WAF', category = 'SECURITY', description = 'Web アプリに届く前に、リクエストをルールで確認。', architecture = '利用者 → AWS WAF → アプリケーション', icon = <ShieldCheck size={32}/> }: { title?: string; category?: string; description?: string; architecture?: string; icon?: ReactNode }) {
  return <section className="service-overview"><div className="service-icon">{icon}</div><div><div className="eyebrow">{category} · INTERACTIVE PLAYGROUND</div><h1>{title}</h1><p>{description}</p><div className="architecture" aria-label="構成">{architecture}</div></div></section>;
}
export function PlaygroundPanel({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`} aria-label={title}><h2>{title}</h2>{children}</section>;
}
export function KnowledgeCards({ cards }: { cards: { title: string; text: string }[] }) {
  return <div className="knowledge-grid">{cards.map(card => <details key={card.title}><summary>{card.title}</summary><p>{card.text}</p></details>)}</div>;
}
