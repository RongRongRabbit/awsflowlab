import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import WafPlayground from './components/WafPlayground';
import AlbPlayground from './components/AlbPlayground';
export default function App() {
  const [service, setService] = useState<'waf' | 'alb'>('waf');
  return <div className="app"><header className="topbar"><div className="brand"><ShieldCheck size={23}/>AWS <b>FlowLab</b></div><a className="guide-link" href="/awsflowlab/developer-guide/">Developer Guide</a></header>
    <nav className="service-nav" aria-label="AWS サービスを選ぶ"><div className="segmented">{([{ id: 'waf', name: 'AWS WAF' }, { id: 'alb', name: 'ALB' }] as const).map(item => <button key={item.id} className={service === item.id ? 'active' : ''} aria-pressed={service === item.id} onClick={() => setService(item.id)}>{item.name}</button>)}</div><p className="muted">サービスを切り替えると設定と実行履歴を初期化します。</p></nav>
    {service === 'waf' ? <WafPlayground/> : <AlbPlayground/>}
  </div>;
}
