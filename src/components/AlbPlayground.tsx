import { useEffect, useState } from 'react';
import { Network } from 'lucide-react';
import { createDefaultListener, targetGroups, type AlbRule, type TargetGroupId } from '../services/alb/albEngine';
import { advanceAlbStep, createAlbExecution, type AlbExecution } from '../services/alb/playback';
import { AlbFlow } from './AlbFlow';
import { KnowledgeCards, PlaygroundPanel, ServiceOverview } from './Playground';
const scenarios = ['既定の Web アプリへ', 'API パスを振り分ける', '画像パスを振り分ける', 'Priority で転送先を変える'];
export function createAlbScenario(index: number) {
  const listener = createDefaultListener();
  if (index === 3) { listener.rules[2].enabled = true; listener.rules[2].priority = 5; }
  return { path: index === 1 || index === 3 ? '/api/users' : index === 2 ? '/images/logo.png' : '/', listener };
}
const knowledge = [
  { title: 'ALB とは？', text: 'Application Load Balancer は HTTP / HTTPS のリクエストを受け取り、ルールに応じてアプリへ振り分けます。WAF の許可・拒否とは役割が異なります。' },
  { title: 'Listener', text: '接続を受け付ける入口です。このモデルは HTTP :80 を使い、パスで転送先を決めます。実際の通信は行いません。' },
  { title: 'Path & Rule', text: '/api/* は /api/ で始まるパスに一致します。大文字と小文字を区別し、転送時にパスを削りません。ここでは固定の3パターンだけを扱います。' },
  { title: 'Priority', text: '1〜50000 の小さい数字から確認し、最初の Match で転送先が決まります。/* を先に置くと API や画像もそのルールで転送されます。' },
  { title: 'Target Group', text: '転送先のアプリをまとめるグループです。実際は複数のターゲットへ負荷分散できますが、このモデルは各グループに正常なアプリ1台を置きます。' },
  { title: 'Default Rule', text: 'どのルールにも一致しなければ最後に実行します。Priority や条件は持たず、既定の転送先を使います。Advanced Settings で転送先を変えてみましょう。' },
];
export default function AlbPlayground() {
  const [listener, setListener] = useState(createDefaultListener);
  const [path, setPath] = useState('/');
  const [scenario, setScenario] = useState<number | null>(0);
  const [execution, setExecution] = useState<AlbExecution | null>(null);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [playbackId, setPlaybackId] = useState(0);
  const loadScenario = (index: number) => { const sample = createAlbScenario(index); setListener(sample.listener); setPath(sample.path); setScenario(index); setExecution(null); setStep(-1); setPlaying(false); setDirty(false); };
  const edited = () => { setDirty(true); setPlaying(false); setScenario(null); };
  const updateRule = (id: string, patch: Partial<AlbRule>) => { setListener(current => ({ ...current, rules: current.rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule) })); edited(); };
  const changePriority = (id: string, priority: number) => {
    if (!Number.isInteger(priority) || priority < 1 || priority > 50000) return;
    setListener(current => { const old = current.rules.find(rule => rule.id === id)!; return { ...current, rules: current.rules.map(rule => rule.id === id ? { ...rule, priority } : rule.priority === priority ? { ...rule, priority: old.priority } : rule) }; }); edited();
  };
  const send = (auto: boolean) => { setExecution(createAlbExecution(path, listener)); setStep(0); setPlaying(auto); setDirty(false); setPlaybackId(id => id + 1); };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); loadScenario(((scenario ?? 0) + (event.key === 'ArrowRight' ? 1 : -1) + scenarios.length) % scenarios.length); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [scenario]);
  useEffect(() => {
    if (!playing || !execution) return;
    if (step >= execution.result.events.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setStep(current => advanceAlbStep(current, execution.result)), 950);
    return () => window.clearTimeout(timer);
  }, [playing, execution, step]);
  const current = execution?.result.events[step];
  const complete = current?.phase === 'destination';
  const targetOptions = targetGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>);
  return <main className="playground"><ServiceOverview icon={<Network size={32}/>} title="Application Load Balancer" category="NETWORKING" description="リクエストのパスを見て、届けるアプリを選ぶ。" architecture="利用者 → ALB → Target Group → アプリケーション"/>
    <PlaygroundPanel title="まずは例を選んでみよう" className="scenario-panel"><div className="scenario-grid">{scenarios.map((name, index) => <button key={name} className={`scenario ${scenario === index ? 'selected' : ''}`} aria-pressed={scenario === index} onClick={() => loadScenario(index)}><span>0{index + 1}</span>{name}</button>)}</div><p className="muted">例は設定を読み込むだけ。「リクエストを送信」で確認しましょう。Alt + ← / → で例を選べます。</p></PlaygroundPanel>
    <PlaygroundPanel title="リクエストの動きを見る" className="visualization"><AlbFlow key={playbackId} listener={listener} execution={execution} step={step}/><div className="execution"><div className="execution-title"><strong>{execution ? `${step + 1} / ${execution.result.events.length}` : 'パスを選んで送信してみましょう'}</strong><span>{playing ? '再生中' : '準備完了'}</span></div>{dirty && <p className="config-notice">設定が変わりました。再送信で反映します。表示中の実行は前の設定です。</p>}
    <div className="demo-actions"><button className="primary" onClick={() => send(true)}>▶ リクエストを送信</button><button className="ghost" onClick={() => loadScenario(0)}>リセット</button></div><div aria-live="polite">{current && !complete && <div className="current-explanation"><strong>{current.title} {current.status}</strong><p>{current.detail}</p></div>}</div>{complete && <div className="result success" role="status"><div><strong>{current.title}</strong><p>{current.detail}</p><p>{execution?.path} → {execution?.result.targetGroupId}（{execution?.result.matchedRuleId ? '一致したルール' : 'Default Rule'}）</p></div></div>}
    <details className="trace-history"><summary>ステップごとに確認・再生</summary><div className="demo-actions"><button className="ghost" onClick={() => { if (!execution || complete || dirty) send(false); else { setPlaying(false); setStep(advanceAlbStep(step, execution.result)); } }}>次のステップ →</button><button className="ghost" disabled={!playing} onClick={() => setPlaying(false)}>一時停止</button><button className="ghost" disabled={!execution} onClick={() => { setStep(0); setPlaying(true); setPlaybackId(id => id + 1); }}>再生</button></div>{execution && <ol className="event-list">{execution.result.events.slice(0, step + 1).map((event, index) => <li key={index} className={index === step ? 'current' : ''}><span>{index + 1}</span><div><strong>{event.title} {event.status}</strong>{index === step && <p>{event.detail}</p>}</div></li>)}</ol>}</details></div></PlaygroundPanel>
    <PlaygroundPanel title="設定を変えて試す"><div className="basic-controls"><label>リクエストのパス <select aria-label="リクエストのパス" value={path} onChange={event => { setPath(event.target.value); edited(); }}>{['/', '/api/users', '/images/logo.png', '/help', '/API/users'].map(value => <option key={value}>{value}</option>)}</select></label>{listener.rules.map(rule => <label key={rule.id}><input type="checkbox" aria-label={`${rule.name} ON/OFF`} checked={rule.enabled} onChange={event => updateRule(rule.id, { enabled: event.target.checked })}/>{rule.name} {rule.enabled ? 'ON' : 'OFF'}</label>)}</div>
    <details className="advanced"><summary>Advanced Settings · Priority と転送先</summary><div className="rule-editor">{[...listener.rules].sort((a, b) => a.priority - b.priority).map(rule => <fieldset key={rule.id}><legend>{rule.name} · {rule.pathPattern}</legend><label>Priority <input aria-label={`${rule.name} Priority`} type="number" min="1" max="50000" step="1" value={rule.priority} onChange={event => { if (event.target.value !== '') changePriority(rule.id, Number(event.target.value)); }}/></label><label>転送先 <select aria-label={`${rule.name} 転送先`} value={rule.targetGroupId} onChange={event => updateRule(rule.id, { targetGroupId: event.target.value as TargetGroupId })}>{targetOptions}</select></label></fieldset>)}<label>Default Rule の転送先 <select aria-label="Default Rule の転送先" value={listener.defaultTargetGroupId} onChange={event => { setListener(value => ({ ...value, defaultTargetGroupId: event.target.value as TargetGroupId })); edited(); }}>{targetOptions}</select></label><p className="muted">Priority は 1〜50000。同じ数字を入力すると順番を交換します。Default Rule は常に最後です。</p></div></details></PlaygroundPanel>
    <PlaygroundPanel title="気になることから学ぶ"><KnowledgeCards cards={knowledge}/></PlaygroundPanel><p className="disclaimer">※ 教育用の簡易モデルです。実際の ALB ではありません。HTTP 通信・AWS 接続は行いません。OFF は評価対象から外すための学習用操作です。ヘルスチェック、複数台への負荷分散、TLS、パスの正規化は再現しません。設定はメモリー内のみです。</p>
  </main>;
}
