import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Expand, RotateCcw, ShieldCheck } from 'lucide-react';
import { createDefaultAcl, type RequestKind, type Rule, type RuleAction, type WebAcl } from './services/waf/wafEngine';
import { advanceStep, createExecution, type Execution } from './services/waf/playback';
import { ExecutionTrace, RequestFlow } from './components/RequestFlow';

export const chapters = [
  { title: 'AWS WAF とは？', time: '45〜60秒', lead: 'Web サイトに届く前に、アクセスを確認', description: '通常のアクセスと、攻撃の特徴を持つサンプルを送ってみましょう。' },
  { title: 'WAF ルールの仕組み', time: '90秒', lead: '条件を確認し、順番に判断する', description: 'まずは一つの例を見て、判定の流れを追いましょう。' },
  { title: 'ルールを変えて試してみよう！', time: '120秒', lead: '同じリクエストでも、設定で結果が変わる', description: '一度に変えるのは一つだけ。送信 → 変更 → 再送信で比べます。' },
];
export type LessonExample = 'decision' | 'count' | 'default';
export function createLessonAcl(example: LessonExample): WebAcl {
  const sample = createDefaultAcl();
  if (example !== 'decision') sample.rules[0].action = 'COUNT';
  if (example === 'count') sample.rules[1].action = 'BLOCK';
  if (example === 'default') sample.rules[1].action = 'COUNT';
  return sample;
}
export default function App() {
  const [chapter, setChapter] = useState(0);
  const [lessonExample, setLessonExample] = useState<LessonExample>('decision');
  const [advanced, setAdvanced] = useState(false);
  const [task, setTask] = useState(0);
  const [taskChanged, setTaskChanged] = useState(false);
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
  const effectiveAcl: WebAcl = chapter === 0 ? { defaultAction: 'ALLOW', rules: [acl.rules.find(rule => rule.id === 'attack')!].map(rule => ({ ...rule, action: 'BLOCK' })) } : chapter === 1 ? createLessonAcl(lessonExample) : acl;
  const send = (auto: boolean) => {
    if (chapter === 2 && execution && step === execution.result.events.length - 1) setPrevious(`${execution.kind === 'normal' ? '通常' : '攻撃サンプル'} → ${execution.result.action} · ${execution.acl.rules.map(r => `${r.name}: ${r.enabled ? r.action : 'OFF'} (P${r.priority})`).join(' / ')} · Default ${execution.acl.defaultAction}`);
    setPlaybackId(id => id + 1); setExecution(createExecution(chapter === 1 || (chapter === 2 && !advanced) ? 'attack' : kind, effectiveAcl)); setStep(0); setPlaying(auto); setDirty(false);
  };
  const updateRule = (id: string, patch: Partial<Rule>) => { setAcl(current => ({ ...current, rules: current.rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule) })); setPlaying(false); setDirty(true); };
  const swapPriority = () => { setAcl(current => ({ ...current, rules: current.rules.map((rule, i) => ({ ...rule, priority: current.rules[1 - i].priority })) })); setPlaying(false); setDirty(true); };
  const changePriority = (id: string, priority: number) => {
    if (!Number.isInteger(priority) || priority < 0) return;
    setAcl(current => { const old = current.rules.find(r => r.id === id)!; return { ...current, rules: current.rules.map(r => r.id === id ? { ...r, priority } : r.priority === priority ? { ...r, priority: old.priority } : r) }; });
    setPlaying(false); setDirty(true);
  };
  const prepareTask = (value: number) => {
    const sample = createDefaultAcl();
    if (value === 1) sample.rules[1].action = 'BLOCK';
    if (value === 2) sample.rules.forEach(rule => { rule.action = 'COUNT'; });
    setTask(value); setTaskChanged(false); setAcl(sample); setKind('attack'); setPrevious(null); reset(); setDirty(false);
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
  const currentEvent = execution?.result.events[step];
  const lessonPoint = {
    decision: '条件に一致（Match）したら、Block で判定を終えます。後のルールは確認しません。',
    count: 'Count は一致を記録するだけ。次のルールの Block まで進みます。',
    default: 'どのルールも Allow / Block を決めなければ、最後に既定の動作を使います。',
  }[lessonExample];
  const taskTitles = ['順番だけを変える', '記録して次へ進める', '最後の動作を変える'];
  const taskInstructions = ['結果を見たら、ルールの順番を入れ替えましょう。', '結果を見たら、検知ルールを Count に変えましょう。', '結果を見たら、Default Action を Block に変えましょう。'];
  return <div className={`app ${presenter ? 'presenter' : ''}`}>
    <header className="topbar"><div className="brand"><ShieldCheck size={24}/><span>AWS <b>FlowLab</b></span><span className="version">v0.2</span></div><div className="header-actions"><span className="duration">初心者向け · 約5分</span><button className="ghost" aria-pressed={presenter} onClick={() => setPresenter(!presenter)}><Expand size={16}/>{presenter ? '通常表示' : '発表モード'}</button></div></header>
    <main className="layout"><aside className="sidebar"><div className="eyebrow">LEARNING PATH</div><h2>AWS WAF Basics</h2><p className="muted">3つのステップで学ぼう</p><nav aria-label="学習チャプター">{chapters.map((item, index) => <button key={item.title} className={`chapter ${chapter === index ? 'selected' : ''}`} aria-current={chapter === index ? 'step' : undefined} onClick={() => goChapter(index)}><span className="chapter-number">0{index + 1}</span><span><strong>{item.title}</strong><small>{item.time}</small></span></button>)}</nav><p className="sidebar-note">教育用シミュレーション · AWS 接続なし</p><a href="./developer-guide/">Developer Guide（中文）</a></aside>
    <section className="main"><div className="intro"><div className="eyebrow">CHAPTER 0{chapter + 1} / 03</div><h1>{chapters[chapter].title}</h1><p className="lead">{chapters[chapter].lead}</p><p className="description">{chapters[chapter].description}</p></div>
      {chapter === 1 && <details className="glossary"><summary>用語を確認する</summary><dl><dt>Web ACL / Rule</dt><dd>ルールをまとめる場所 / アクセスを確認するルール。</dd><dt>Condition / Match</dt><dd>確認する条件 / 条件に一致すること。No Match なら次へ進みます。</dd><dt>Action</dt><dd>一致したときの動作。Allow は許可、Block は拒否して終了。Count は記録して次へ。</dd><dt>Priority</dt><dd>確認する順番。数字が小さいルールから実行します。</dd><dt>Default Action</dt><dd>最後まで Allow / Block が決まらなかったときの動作。</dd></dl></details>}
      <div className="demo"><div className="demo-heading"><span className="live-dot"/>{chapter === 1 ? 'RULE WALKTHROUGH' : chapter === 2 ? 'RULE LAB' : 'INTERACTIVE DEMO'}<span className="demo-hint">{chapter === 1 ? '固定の例を一歩ずつ確認' : chapter === 2 ? '設定を変えて結果を比較' : '矢印の順に確認'}</span></div>
      {chapter === 1 && <section className="lesson-examples" aria-label="説明用の固定例"><strong>学ぶ例を選ぼう</strong><div className="segmented">{([{ id: 'decision', label: '① Match と終了' }, { id: 'count', label: '② Count は次へ' }, { id: 'default', label: '③ Default Action' }] as const).map(example => <button key={example.id} aria-pressed={lessonExample === example.id} className={lessonExample === example.id ? 'active' : ''} onClick={() => { setLessonExample(example.id); reset(); setDirty(false); }}>{example.label}</button>)}</div><p className="focus-point">{lessonPoint}</p></section>}
      {chapter === 2 && <section className="practice-guide" aria-label="練習ガイド"><div className="execution-title"><strong>練習 {task + 1} / 3：{taskTitles[task]}</strong><button className="ghost" onClick={() => prepareTask(task)}>この練習を準備（設定を初期化）</button></div><p className="focus-point">{!execution ? '「この練習を準備」で設定をそろえ、攻撃サンプルを送信しましょう。' : dirty ? '変更できました。同じサンプルをもう一度送信しましょう。' : !complete ? '判定の流れを確認しましょう。' : taskChanged ? task === 2 ? '変更前と結果を比べられました。基本の練習は完了です。' : '変更前と結果を比べましょう。次の練習へ進めます。' : taskInstructions[task]}</p>{!advanced && <div className="guided-controls">{task === 0 ? <button className="ghost" disabled={!complete || dirty} onClick={() => { swapPriority(); setTaskChanged(true); }}>ルールの順番を入れ替え</button> : task === 1 ? <label>検知ルールの動作 <select aria-label="検知ルールの動作" disabled={!complete || dirty} value={acl.rules[0].action} onChange={e => { updateRule('attack', { action: e.target.value as RuleAction }); setTaskChanged(true); }}><option value="BLOCK">Block</option><option value="COUNT">Count</option><option value="ALLOW">Allow</option></select></label> : <label>Default Action <select aria-label="練習の Default Action" disabled={!complete || dirty} value={acl.defaultAction} onChange={e => { setAcl(current => ({ ...current, defaultAction: e.target.value as 'ALLOW' | 'BLOCK' })); setDirty(true); setPlaying(false); setTaskChanged(true); }}><option value="ALLOW">Allow</option><option value="BLOCK">Block</option></select></label>}{task < 2 && <button className="primary" disabled={!complete || dirty || !taskChanged} onClick={() => prepareTask(task + 1)}>次の練習へ →</button>}</div>}<button className="settings-toggle" aria-expanded={advanced} onClick={() => { const nextAdvanced = !advanced; setAdvanced(nextAdvanced); setPlaying(false); if (execution && (nextAdvanced ? kind : 'attack') !== execution.kind) setDirty(true); }}>{advanced ? '詳しい設定を閉じる' : '詳しい設定を開く'}</button></section>}
      <RequestFlow key={playbackId} execution={execution} step={step} rules={effectiveAcl.rules} detailed={chapter > 0}/>
      {(chapter === 0 || (chapter === 2 && advanced)) && <div className="controls"><div className="control-group"><label>アクセスの種類</label><div className="segmented"><button aria-pressed={kind === 'normal'} className={kind === 'normal' ? 'active' : ''} onClick={() => { setKind('normal'); setPlaying(false); setDirty(true); }}>🙂 通常アクセス</button><button aria-pressed={kind === 'attack'} className={kind === 'attack' ? 'active' : ''} onClick={() => { setKind('attack'); setPlaying(false); setDirty(true); }}>⚠️ 攻撃サンプル</button></div></div>
      {chapter === 0 && <label className="toggle">攻撃検知ルール<input type="checkbox" aria-label="攻撃検知ルール" checked={acl.rules[0].enabled} onChange={e => updateRule('attack', { enabled: e.target.checked })}/><span className="switch"/><b>{acl.rules[0].enabled ? 'ON' : 'OFF'}</b></label>}</div>}
      {chapter === 2 && advanced && <div className="rule-editor"><div className="execution-title"><strong>Web ACL の設定</strong><button className="ghost" onClick={swapPriority}>ルールの順番を入れ替え</button></div>{[...acl.rules].sort((a, b) => a.priority - b.priority).map(rule => <fieldset key={rule.id}><legend>{rule.name}</legend><label><input type="checkbox" aria-label={`${rule.name} Enabled`} checked={rule.enabled} onChange={e => updateRule(rule.id, { enabled: e.target.checked })}/> Enabled</label><label>Condition <span>{rule.condition === 'attack' ? '攻撃サンプルに一致' : 'すべてのサンプルに一致'}</span></label><label>Action <select aria-label={`${rule.name} Action`} value={rule.action} onChange={e => updateRule(rule.id, { action: e.target.value as RuleAction })}><option value="ALLOW">Allow</option><option value="BLOCK">Block</option><option value="COUNT">Count</option></select></label><label>Priority <input aria-label={`${rule.name} Priority`} type="number" min="0" step="1" value={rule.priority} onChange={e => { if (e.target.value !== '') changePriority(rule.id, Number(e.target.value)); }}/></label></fieldset>)}<label className="default-control">Default Action <select aria-label="Default Action" value={acl.defaultAction} onChange={e => { setAcl(current => ({ ...current, defaultAction: e.target.value as 'ALLOW' | 'BLOCK' })); setPlaying(false); setDirty(true); }}><option value="ALLOW">Allow</option><option value="BLOCK">Block</option></select></label><p className="muted">Priority は小さい数字から。同じ数字に変えると順番を交換します。「すべてに Allow」を先に置く例は、順番の影響を学ぶための設定です。</p></div>}
      <div className="execution"><div className="execution-title"><strong>実行ステップ</strong><span>{execution ? `${step + 1} / ${execution.result.events.length}` : '準備完了'}</span></div>{(chapter === 0 || (chapter === 2 && advanced)) && dirty && <p className="config-notice">設定が変わりました。再送信で反映します。表示中の実行は前の設定です。</p>}<div aria-live="polite">{currentEvent && !complete && <div className="current-explanation"><strong>{currentEvent.title}{currentEvent.status && ` · ${currentEvent.status}`}</strong><p>{currentEvent.detail}</p></div>}</div>{execution && <details className="trace-history"><summary>これまでの流れを見る</summary><ExecutionTrace result={execution.result} step={step}/></details>}<div className="demo-actions"><button className="primary" onClick={() => send(chapter !== 1)}>{chapter === 1 ? '例を確認' : '▶ リクエストを送信'}</button><button className="ghost" onClick={() => { if (!execution || complete || dirty) send(false); else { setPlaying(false); setStep(advanceStep(step, execution.result)); } }}>次のステップ →</button><button className="ghost" disabled={!execution} onClick={() => { setPlaybackId(id => id + 1); setStep(0); setPlaying(chapter !== 1); }}>{chapter === 1 ? '最初から' : '再生'}</button>{chapter !== 1 && <button className="ghost" disabled={!playing} onClick={() => setPlaying(false)}>一時停止</button>}<button className="ghost" onClick={reset}><RotateCcw size={16}/>リセット</button></div></div>
      {complete && <div className={`result ${execution.result.action === 'BLOCK' ? 'danger' : 'success'}`} role="status"><div><strong>最終結果：{execution.result.action}</strong><p>{execution.result.events[step].detail}</p>{chapter > 0 && <p>Count：{execution.result.countedRuleIds.length} 件（このリクエスト）</p>}</div></div>}
      {chapter === 2 && previous && <div className="previous"><strong>前の結果：{previous.split(' · ')[0]}</strong><details><summary>前の設定を見る</summary><p>前の実行：{previous}</p></details></div>}</div>
      {chapter === 0 && <div className="lesson"><p>正常なアクセスは通過し、条件に一致するアクセスはルールで止められます。OFF にすると、この例では攻撃サンプルも通過します。</p></div>}
      {chapter === 2 && complete && !dirty && (advanced || (task === 2 && taskChanged)) && <p className="description">まとめ：WAF は条件と順番でアクセスを判断します。適切なルール設定と、継続的な見直しが大切です。</p>}
      <div className="navigation"><button className="ghost" disabled={chapter === 0} onClick={() => goChapter(chapter - 1)}><ArrowLeft size={16}/>前へ</button><span>{chapter + 1} / 3</span><button className="primary" disabled={chapter === 2} onClick={() => goChapter(chapter + 1)}>次の章へ<ArrowRight size={16}/></button></div>
      <p className="disclaimer">※ 教育用の簡易モデルです。実際の AWS WAF ではありません。HTTP 解析・攻撃検知・AWS 接続は行いません。設定はブラウザーのメモリー内のみで、再読み込みで初期化されます。</p>
    </section></main>
  </div>;
}
