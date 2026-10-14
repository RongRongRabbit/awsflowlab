import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Expand, RotateCcw, ShieldCheck } from 'lucide-react';
import { createDefaultAcl, type RequestKind, type Rule, type RuleAction, type WebAcl } from './services/waf/wafEngine';
import { advanceStep, createExecution, type Execution } from './services/waf/playback';
import { ExecutionTrace, RequestFlow } from './components/RequestFlow';

export const chapters = [
  { title: 'AWS WAF とは？', time: '45〜60秒', lead: 'Web サイトに届く前に、アクセスを確認', description: '通常のアクセスと、攻撃の特徴を持つサンプルを送ってみましょう。' },
  { title: 'WAF ルールの仕組み', time: '90秒', lead: '条件を確認し、順番に判断する', description: 'Web ACL はルールをまとめる場所です。数字の小さい Priority から確認します。' },
  { title: 'ルールを変えて試してみよう！', time: '120秒', lead: '同じリクエストでも、設定で結果が変わる', description: 'Action や順番を変えて再送信し、前の結果と比べましょう。' },
];
export default function App() {
  const [chapter, setChapter] = useState(0);
  const [kind, setKind] = useState<RequestKind>('normal');
  const [acl, setAcl] = useState<WebAcl>(createDefaultAcl);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [presenter, setPresenter] = useState(false);
  const [previous, setPrevious] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [playbackId, setPlaybackId] = useState(0);
  const reset = () => { setPlaying(false); setStep(-1); setExecution(null); };
  const goChapter = (value: number) => { setChapter(Math.max(0, Math.min(chapters.length - 1, value))); reset(); setDirty(false); };
  const effectiveAcl: WebAcl = chapter === 0 ? { defaultAction: 'ALLOW', rules: [acl.rules.find(rule => rule.id === 'attack')!].map(rule => ({ ...rule, action: 'BLOCK' })) } : acl;
  const send = (auto: boolean) => {
    if (execution && step === execution.result.events.length - 1) setPrevious(`${execution.kind === 'normal' ? '通常' : '攻撃サンプル'} → ${execution.result.action} · ${execution.acl.rules.map(r => `${r.name}: ${r.enabled ? r.action : 'OFF'} (P${r.priority})`).join(' / ')} · Default ${execution.acl.defaultAction}`);
    setPlaybackId(id => id + 1); setExecution(createExecution(kind, effectiveAcl)); setStep(0); setPlaying(auto); setDirty(false);
  };
  const updateRule = (id: string, patch: Partial<Rule>) => { setAcl(current => ({ ...current, rules: current.rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule) })); setPlaying(false); setDirty(true); };
  const swapPriority = () => { setAcl(current => ({ ...current, rules: current.rules.map((rule, i) => ({ ...rule, priority: current.rules[1 - i].priority })) })); setPlaying(false); setDirty(true); };
  const changePriority = (id: string, priority: number) => {
    if (!Number.isInteger(priority) || priority < 0) return;
    setAcl(current => { const old = current.rules.find(r => r.id === id)!; return { ...current, rules: current.rules.map(r => r.id === id ? { ...r, priority } : r.priority === priority ? { ...r, priority: old.priority } : r) }; });
    setPlaying(false); setDirty(true);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); goChapter(chapter + (event.key === 'ArrowRight' ? 1 : -1)); } if (event.key === 'Escape') setPresenter(false); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [chapter]);
  useEffect(() => {
    if (!playing || !execution) return;
    if (step >= execution.result.events.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setStep(current => advanceStep(current, execution.result)), 950);
    return () => window.clearTimeout(timer);
  }, [playing, execution, step]);
  const complete = !!execution && step === execution.result.events.length - 1;
  return <div className={`app ${presenter ? 'presenter' : ''}`}>
    <header className="topbar"><div className="brand"><ShieldCheck size={24}/><span>AWS <b>FlowLab</b></span><span className="version">v0.2</span></div><div className="header-actions"><span className="duration">初心者向け · 約5分</span><button className="ghost" aria-pressed={presenter} onClick={() => setPresenter(!presenter)}><Expand size={16}/>{presenter ? '通常表示' : '発表モード'}</button></div></header>
    <main className="layout"><aside className="sidebar"><div className="eyebrow">LEARNING PATH</div><h2>AWS WAF Basics</h2><p className="muted">3つのステップで学ぼう</p><nav aria-label="学習チャプター">{chapters.map((item, index) => <button key={item.title} className={`chapter ${chapter === index ? 'selected' : ''}`} aria-current={chapter === index ? 'step' : undefined} onClick={() => goChapter(index)}><span className="chapter-number">0{index + 1}</span><span><strong>{item.title}</strong><small>{item.time}</small></span></button>)}</nav><p className="sidebar-note">教育用シミュレーション · AWS 接続なし</p><a href="./developer-guide/">Developer Guide（中文）</a></aside>
    <section className="main"><div className="intro"><div className="eyebrow">CHAPTER 0{chapter + 1} / 03</div><h1>{chapters[chapter].title}</h1><p className="lead">{chapters[chapter].lead}</p><p className="description">{chapters[chapter].description}</p></div>
      {chapter === 1 && <div className="concepts"><div><b>Rule / Condition</b><p>ルールの条件に一致すれば Match。一致しなければ No Match で次へ。</p></div><div><b>Action</b><p><span className="allow">Allow</span>：許可して終了。<span className="block">Block</span>：拒否して終了。<span className="count">Count</span>：記録して次へ。</p></div><div><b>Default Action</b><p>最後まで Allow / Block が決まらなければ適用。Count は最終結果ではありません。</p></div></div>}
      <div className="demo"><div className="demo-heading"><span className="live-dot"/>INTERACTIVE DEMO<span className="demo-hint">矢印の順に確認</span></div>
      <RequestFlow key={playbackId} execution={execution} step={step} rules={effectiveAcl.rules} detailed={chapter > 0}/>
      <div className="controls"><div className="control-group"><label>アクセスの種類</label><div className="segmented"><button aria-pressed={kind === 'normal'} className={kind === 'normal' ? 'active' : ''} onClick={() => { setKind('normal'); setPlaying(false); setDirty(true); }}>🙂 通常アクセス</button><button aria-pressed={kind === 'attack'} className={kind === 'attack' ? 'active' : ''} onClick={() => { setKind('attack'); setPlaying(false); setDirty(true); }}>⚠️ 攻撃サンプル</button></div></div>
      {chapter === 0 && <label className="toggle">攻撃検知ルール<input type="checkbox" aria-label="攻撃検知ルール" checked={acl.rules[0].enabled} onChange={e => updateRule('attack', { enabled: e.target.checked })}/><span className="switch"/><b>{acl.rules[0].enabled ? 'ON' : 'OFF'}</b></label>}</div>
      {chapter > 0 && <div className="rule-editor"><div className="execution-title"><strong>Web ACL の設定</strong><button className="ghost" onClick={swapPriority}>ルールの順番を入れ替え</button></div>{[...acl.rules].sort((a, b) => a.priority - b.priority).map(rule => <fieldset key={rule.id}><legend>{rule.name}</legend><label><input type="checkbox" aria-label={`${rule.name} Enabled`} checked={rule.enabled} onChange={e => updateRule(rule.id, { enabled: e.target.checked })}/> Enabled</label><label>Condition <span>{rule.condition === 'attack' ? '攻撃サンプルに一致' : 'すべてのサンプルに一致'}</span></label><label>Action <select aria-label={`${rule.name} Action`} value={rule.action} onChange={e => updateRule(rule.id, { action: e.target.value as RuleAction })}><option value="ALLOW">Allow</option><option value="BLOCK">Block</option><option value="COUNT">Count</option></select></label><label>Priority <input aria-label={`${rule.name} Priority`} type="number" min="0" step="1" value={rule.priority} onChange={e => { if (e.target.value !== '') changePriority(rule.id, Number(e.target.value)); }}/></label></fieldset>)}<label className="default-control">Default Action <select aria-label="Default Action" value={acl.defaultAction} onChange={e => { setAcl(current => ({ ...current, defaultAction: e.target.value as 'ALLOW' | 'BLOCK' })); setPlaying(false); setDirty(true); }}><option value="ALLOW">Allow</option><option value="BLOCK">Block</option></select></label><p className="muted">Priority は小さい数字から。同じ数字に変えると順番を交換します。「すべてに Allow」を先に置く例は、順番の影響を学ぶための設定です。</p></div>}
      <div className="execution"><div className="execution-title"><strong>実行ステップ</strong><span>{execution ? `${step + 1} / ${execution.result.events.length}` : '準備完了'}</span></div>{dirty && <p className="config-notice">設定が変わりました。再送信で反映します。表示中の実行は前の設定です。</p>}<div aria-live="polite">{execution && <ExecutionTrace result={execution.result} step={step}/>}</div><div className="demo-actions"><button className="primary" onClick={() => send(true)}>▶ リクエストを送信</button><button className="ghost" onClick={() => { if (!execution || complete || dirty) send(false); else { setPlaying(false); setStep(advanceStep(step, execution.result)); } }}>次のステップ →</button><button className="ghost" disabled={!execution} onClick={() => { setPlaybackId(id => id + 1); setStep(0); setPlaying(true); }}>再生</button><button className="ghost" disabled={!playing} onClick={() => setPlaying(false)}>一時停止</button><button className="ghost" onClick={reset}><RotateCcw size={16}/>リセット</button></div></div>
      {complete && <div className={`result ${execution.result.action === 'BLOCK' ? 'danger' : 'success'}`} role="status"><div><strong>最終結果：{execution.result.action}</strong><p>{execution.result.events[step].detail}</p><p>Count：{execution.result.countedRuleIds.length} 件（このリクエスト）</p></div></div>}
      {previous && <p className="previous">前の実行：{previous}</p>}</div>
      <div className="lesson"><p>{chapter === 0 ? '正常なアクセスは通過し、条件に一致するアクセスはルールで止められます。OFF にすると、この例では攻撃サンプルも通過します。' : chapter === 1 ? 'Allow / Block で終了。Count は次へ。最後まで決まらなければ Default Action。' : '試してみよう：攻撃サンプルを送信 → 順番を交換 → 再送信。次に検知ルールを Count に変えて、後のルールまで進むか確認しましょう。'}</p></div>
      {chapter === 2 && <p className="description">まとめ：WAF は条件と順番でアクセスを判断します。適切なルール設定と、継続的な見直しが大切です。</p>}
      <div className="navigation"><button className="ghost" disabled={chapter === 0} onClick={() => goChapter(chapter - 1)}><ArrowLeft size={16}/>前へ</button><span>{chapter + 1} / 3</span><button className="primary" disabled={chapter === 2} onClick={() => goChapter(chapter + 1)}>次の章へ<ArrowRight size={16}/></button></div>
      <p className="disclaimer">※ 教育用の簡易モデルです。実際の AWS WAF ではありません。HTTP 解析・攻撃検知・AWS 接続は行いません。設定はブラウザーのメモリー内のみで、再読み込みで初期化されます。</p>
    </section></main>
  </div>;
}
