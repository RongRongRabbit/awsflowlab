import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { createDefaultAcl, type RequestKind, type Rule, type RuleAction, type WebAcl } from './services/waf/wafEngine';
import { advanceStep, createExecution, type Execution } from './services/waf/playback';
import { ExecutionTrace, RequestFlow } from './components/RequestFlow';
import { KnowledgeCards, PlaygroundPanel, ServiceOverview } from './components/Playground';

export const scenarios = ['通常のリクエスト', '不審なリクエストを Block', 'Block を Count に変更', 'ルールの順番を変更'];
export function createScenario(index: number): { kind: RequestKind; acl: WebAcl } {
  const acl = createDefaultAcl();
  if (index === 2) acl.rules[0].action = 'COUNT';
  if (index === 3) [acl.rules[0].priority, acl.rules[1].priority] = [acl.rules[1].priority, acl.rules[0].priority];
  return { kind: index === 0 ? 'normal' : 'attack', acl };
}
const knowledge = [
  { title: 'AWS WAF とは？', text: 'Web アプリを保護するために、届くリクエストを確認するサービスです。この画面では通常と攻撃の特徴を持つサンプルで試せます。' },
  { title: 'Web ACL', text: 'ルールと既定の動作をまとめた設定です。利用者とアプリの間で、リクエストをどう扱うか決めます。' },
  { title: 'Rule & Condition', text: 'Rule は確認するルール、Condition は一致する条件です。Match なら指定した動作へ、No Match なら次のルールへ進みます。OFF のルールは確認しません。' },
  { title: 'Action', text: 'Allow は許可、Block は拒否して判定を終了。Count は一致を記録し、次へ進みます。Count の数は今回のリクエストだけの記録です。' },
  { title: 'Priority', text: '数字が小さいルールから確認します。Allow / Block で終了すると、後のルールは未評価です。「すべてに Allow」を先に置く例は順番を学ぶための設定です。' },
  { title: 'Default Action', text: '最後まで Allow / Block が決まらなかった場合の動作です。Advanced Settings で両ルールを Count にして、Allow / Block を比べてみましょう。' },
];
export default function App() {
  const [kind, setKind] = useState<RequestKind>('normal');
  const [acl, setAcl] = useState<WebAcl>(createDefaultAcl);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [playbackId, setPlaybackId] = useState(0);
  const [scenario, setScenario] = useState<number | null>(0);
  const [previous, setPrevious] = useState<string | null>(null);
  const clear = () => { setPlaying(false); setExecution(null); setStep(-1); setDirty(false); setPrevious(null); };
  const loadScenario = (index: number) => { const sample = createScenario(index); setKind(sample.kind); setAcl(sample.acl); setScenario(index); clear(); };
  const reset = () => loadScenario(0);
  const edited = () => { setPlaying(false); setDirty(true); setScenario(null); };
  const updateRule = (id: string, patch: Partial<Rule>) => { setAcl(current => ({ ...current, rules: current.rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule) })); edited(); };
  const changePriority = (id: string, priority: number) => {
    if (!Number.isSafeInteger(priority) || priority < 0) return;
    setAcl(current => { const old = current.rules.find(rule => rule.id === id)!; return { ...current, rules: current.rules.map(rule => rule.id === id ? { ...rule, priority } : rule.priority === priority ? { ...rule, priority: old.priority } : rule) }; }); edited();
  };
  const send = (auto: boolean) => {
    if (execution && step === execution.result.events.length - 1) setPrevious(`${execution.kind === 'normal' ? '通常' : '攻撃サンプル'} → ${execution.result.action} · ${execution.acl.rules.map(rule => `${rule.name}: ${rule.enabled ? rule.action : 'OFF'} (P${rule.priority})`).join(' / ')} · Default ${execution.acl.defaultAction}`);
    setExecution(createExecution(kind, acl)); setStep(0); setPlaying(auto); setDirty(false); setPlaybackId(id => id + 1);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); loadScenario(((scenario ?? 0) + (event.key === 'ArrowRight' ? 1 : -1) + scenarios.length) % scenarios.length); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [scenario]);
  useEffect(() => {
    if (!playing || !execution) return;
    if (step >= execution.result.events.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setStep(current => advanceStep(current, execution.result)), 950);
    return () => window.clearTimeout(timer);
  }, [playing, execution, step]);
  const complete = !!execution && step === execution.result.events.length - 1;
  const current = execution?.result.events[step];
  const actionControl = (rule: Rule) => <label>Action <select aria-label={`${rule.name} Action`} value={rule.action} onChange={event => updateRule(rule.id, { action: event.target.value as RuleAction })}><option value="ALLOW">Allow</option><option value="BLOCK">Block</option><option value="COUNT">Count</option></select></label>;
  return <div className="app">
    <header className="topbar"><div className="brand"><ShieldCheck size={23}/>AWS <b>FlowLab</b></div><div className="header-actions"><a href={'/awsflowlab/developer-guide/'}>Developer Guide</a></div></header>
    <main className="playground"><ServiceOverview/>
    <PlaygroundPanel title="まずは例を選んでみよう" className="scenario-panel"><div className="scenario-grid">{scenarios.map((name, index) => <button key={name} className={`scenario ${scenario === index ? 'selected' : ''}`} aria-pressed={scenario === index} onClick={() => loadScenario(index)}><span>0{index + 1}</span>{name}</button>)}</div><p className="muted">まずは通常のリクエストを送ってみましょう。設定だけを読み込みます。「リクエストを送信」で動きを確認。Alt + ← / → で例を選択できます。</p></PlaygroundPanel>
    <PlaygroundPanel title="リクエストの動きを見る" className="visualization"><div className="visual-heading"><span className="live-dot"/><span>HTTP REQUEST → RULE EVALUATION → FINAL DECISION</span></div><RequestFlow key={playbackId} execution={execution} step={step} rules={acl.rules} detailed={true}/>
    <div className="execution"><div className="execution-title"><strong>{execution ? `${step + 1} / ${execution.result.events.length}` : '例を選ぶ → 送信 → 設定を変えて再送信'}</strong><span>{playing ? '再生中' : '準備完了'}</span></div>{dirty && <p className="config-notice">設定が変わりました。再送信で反映します。表示中の実行は前の設定です。</p>}
    <div className="demo-actions"><button className="primary" onClick={() => send(true)}>▶ リクエストを送信</button><button className="ghost" onClick={reset}>リセット</button></div><div aria-live="polite">{current && !complete && <div className="current-explanation"><strong>{current.title} {current.status}</strong><p>{current.detail}</p></div>}</div>
    {complete && <div className={`result ${execution.result.action === 'BLOCK' ? 'danger' : 'success'}`} role="status"><div><strong>最終結果：{execution.result.action}</strong><p>{current?.detail}</p><p>Count：{execution.result.countedRuleIds.length} 件（このリクエスト）</p></div></div>}
    <details className="trace-history"><summary>ステップごとに確認・再生</summary><div className="demo-actions"><button className="ghost" onClick={() => { if (!execution || complete || dirty) send(false); else { setPlaying(false); setStep(advanceStep(step, execution.result)); } }}>次のステップ →</button><button className="ghost" disabled={!playing} onClick={() => setPlaying(false)}>一時停止</button><button className="ghost" disabled={!execution} onClick={() => { setStep(0); setPlaying(true); setPlaybackId(id => id + 1); }}>再生</button></div>{execution && <ExecutionTrace result={execution.result} step={step}/>}</details>
    {previous && <details className="previous"><summary>前の結果と比較</summary><p>{previous}</p></details>}</div></PlaygroundPanel>
    <PlaygroundPanel title="設定を変えて試す" className="control-panel"><div className="basic-controls"><div className="segmented">{(['normal', 'attack'] as const).map(value => <button key={value} aria-pressed={kind === value} className={kind === value ? 'active' : ''} onClick={() => { setKind(value); edited(); }}>{value === 'normal' ? '通常アクセス' : '攻撃サンプル'}</button>)}</div><label><input type="checkbox" aria-label="攻撃検知ルール" checked={acl.rules[0].enabled} onChange={event => updateRule('attack', { enabled: event.target.checked })}/>攻撃検知ルール {acl.rules[0].enabled ? 'ON' : 'OFF'}</label>{actionControl(acl.rules[0])}</div>
    <details className="advanced"><summary>Advanced Settings · 優先順位と既定の動作</summary><div className="rule-editor">{[...acl.rules].sort((a, b) => a.priority - b.priority).map(rule => <fieldset key={rule.id}><legend>{rule.name}</legend><label><input type="checkbox" aria-label={`${rule.name} Enabled`} checked={rule.enabled} onChange={event => updateRule(rule.id, { enabled: event.target.checked })}/>ON / OFF</label><span>条件：{rule.condition === 'attack' ? '攻撃サンプル' : 'すべてのサンプル'}</span>{rule.id !== 'attack' && actionControl(rule)}<label>Priority <input type="number" min="0" step="1" aria-label={`${rule.name} Priority`} value={rule.priority} onChange={event => { if (event.target.value !== '') changePriority(rule.id, Number(event.target.value)); }}/></label></fieldset>)}<label>Default Action <select aria-label="Default Action" value={acl.defaultAction} onChange={event => { setAcl(currentAcl => ({ ...currentAcl, defaultAction: event.target.value as 'ALLOW' | 'BLOCK' })); edited(); }}><option value="ALLOW">Allow</option><option value="BLOCK">Block</option></select></label><p className="muted">小さい Priority から確認。同じ数字を入力すると順番を交換します。全リクエストの Allow は優先順位を学ぶための例です。</p></div></details></PlaygroundPanel>
    <PlaygroundPanel title="気になることから学ぶ"><KnowledgeCards cards={knowledge}/></PlaygroundPanel>
    <p className="disclaimer">※ 教育用の簡易モデルです。実際の AWS WAF ではありません。HTTP 解析・攻撃検知・AWS 接続は行いません。設定はブラウザーのメモリー内のみで、再読み込みで初期化されます。</p></main>
  </div>;
}
