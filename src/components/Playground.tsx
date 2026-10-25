import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
export function ServiceOverview({ children }: { children: ReactNode }) {
  return <section className="service-overview"><div className="service-icon"><ShieldCheck size={32}/></div><div><div className="eyebrow">SECURITY · INTERACTIVE PLAYGROUND</div><h1>AWS WAF</h1><p>Web アプリに届く前に、リクエストをルールで確認。</p><div className="architecture" aria-label="構成">利用者 → AWS WAF → アプリケーション</div></div>{children}</section>;
}
export function PlaygroundPanel({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`} aria-label={title}><h2>{title}</h2>{children}</section>;
}
export function KnowledgeCards({ cards }: { cards: { title: string; text: string }[] }) {
  return <div className="knowledge-grid">{cards.map(card => <details key={card.title}><summary>{card.title}</summary><p>{card.text}</p></details>)}</div>;
}
