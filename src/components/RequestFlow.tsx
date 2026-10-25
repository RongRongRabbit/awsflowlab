import type { Execution } from '../services/waf/playback';
import type { Rule, WafResult } from '../services/waf/wafEngine';
export function RequestFlow({ execution, step, rules, detailed }: { execution: Execution | null; step: number; rules: Rule[]; detailed: boolean }) {
  const result = execution?.result;
  const current = result?.events[step];
  const done = current?.phase === 'destination';
  const basicRule = result?.events.slice(0, step + 1).find(event => event.phase === 'rule');
  const ordered = [...(execution?.acl.rules ?? rules)].sort((a, b) => a.priority - b.priority);
  const status = (id: string) => {
    const index = result?.events.findIndex(event => event.ruleId === id) ?? -1;
    return index >= 0 && index <= step ? result!.events[index] : undefined;
  };
  return <div className="flow-scroll"><div className={`diagram ${detailed ? 'detailed' : ''}`} aria-label="リクエストの流れ">
    <div className={`node ${current?.phase === 'request' ? 'activated' : ''}`}>👤<strong>利用者</strong><small>HTTP Request</small></div>
    <div className={`link ${current?.phase === 'request' ? 'flowing' : ''}`}><span className="particle"/><span className="link-label">→</span></div>
    {detailed ? <div className="acl"><span className="eyebrow">WEB ACL · ルールの集合</span><div className="rule-flow">{ordered.map((rule, index) => {
      const event = status(rule.id);
      const active = current?.ruleId === rule.id;
      const skipped = done && !event;
      return <div className="rule-flow-item" key={rule.id}>{index > 0 && <div className={`link ${active ? 'flowing' : ''}`}><span className="particle"/>→</div>}<div className={`node rule-node ${active ? 'activated' : ''} ${event?.action?.toLowerCase() ?? ''}`}><small>Priority {rule.priority}</small><strong>{rule.name}</strong><small>{event ? event.status : skipped ? '未評価（前のルールで終了）' : '待機中'}</small>{event?.action && <b>{event.action}</b>}</div></div>;
    })}</div>{current?.phase === 'default' && <div className={`default-pill ${current.action?.toLowerCase()}`}>{current.title}</div>}</div>
      : <div className={`node waf ${current?.phase === 'rule' ? 'activated' : ''}`}><strong>🛡 AWS WAF</strong><small>{basicRule?.status ?? 'ルールを確認'}</small></div>}
    <div className={`link ${done && result?.action === 'ALLOW' ? 'flowing' : ''} ${done && result?.action === 'BLOCK' ? 'blocked' : ''}`}><span className="particle"/><span className="link-label">{done ? result?.action : '→'}</span></div>
    <div className={`node ${done && result?.action === 'ALLOW' ? 'activated' : ''} ${done && result?.action === 'BLOCK' ? 'disabled' : ''}`}>🌐<strong>Web サイト</strong><small>{done ? result?.action === 'BLOCK' ? '到達しない' : 'アクセス到達' : '保護対象'}</small></div>
  </div></div>;
}
export function ExecutionTrace({ result, step }: { result: WafResult; step: number }) {
  return <ol className="event-list">{result.events.slice(0, step + 1).map((event, index) => <li key={index} className={`${index === step ? 'current' : ''} ${event.action?.toLowerCase() ?? ''}`}><span>{index + 1}</span><div><strong>{event.title} {event.status && <small>{event.status}</small>}</strong>{index === step && <p>{event.detail}</p>}</div></li>)}</ol>;
}
