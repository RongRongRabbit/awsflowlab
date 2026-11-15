import { targetGroups, type Listener } from '../services/alb/albEngine';
import type { AlbExecution } from '../services/alb/playback';
export function AlbFlow({ execution, listener, step }: { execution: AlbExecution | null; listener: Listener; step: number }) {
  const events = execution?.result.events.slice(0, step + 1) ?? [];
  const current = events[events.length - 1];
  const forwarding = current?.phase === 'forward' || current?.phase === 'destination';
  const rules = [...(execution?.listener ?? listener).rules].sort((a, b) => a.priority - b.priority);
  return <div className="flow-scroll"><div className="alb-diagram" aria-label="ALB のリクエストの流れ">
    <div className={`node ${current?.phase === 'request' ? 'activated' : ''}`}><strong>利用者</strong><small>{execution ? `GET ${execution.path}` : 'HTTP Request'}</small></div>
    <div className={`link ${current?.phase === 'request' ? 'flowing' : ''}`}><span className="particle"/></div>
    <div className="alb-listener"><div className="eyebrow">ALB · HTTP LISTENER :80</div>{rules.map(rule => {
      const event = events.find(event => event.ruleId === rule.id);
      return <div key={rule.id} className={`alb-rule ${current?.ruleId === rule.id ? 'activated' : ''}`}><span>Priority {rule.priority} · {rule.name}</span><code>{rule.pathPattern}</code><small>{event?.status ?? (forwarding ? '未評価（前のルールで終了）' : '待機中')}</small></div>;
    })}<div className={`alb-rule ${current?.phase === 'default' ? 'activated' : ''}`}>Default Rule<small>{events.some(event => event.phase === 'default') ? '既定の転送先を使用' : '最後に評価'}</small></div></div>
    <div className={`link ${current?.phase === 'forward' ? 'flowing' : ''}`}><span className="particle"/></div>
    <div className="alb-targets">{targetGroups.map(group => <div key={group.id} className={`node alb-target ${forwarding && current.targetGroupId === group.id ? 'activated' : ''}`}><strong>{group.name}</strong><small>→ {group.application} × 1</small><b>{forwarding && current.targetGroupId === group.id ? current.phase === 'destination' ? '到達' : '転送中' : '待機中'}</b></div>)}</div>
  </div></div>;
}
