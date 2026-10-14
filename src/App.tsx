import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, Expand, RotateCcw, ShieldCheck, ShieldX, Sparkles } from 'lucide-react';
import { evaluateWaf, type RequestKind } from './services/waf/wafEngine';

const chapters = [
  {title:'AWS WAF ってなに？', time:'45秒', lead:'Web サイトを守る「セキュリティの門番」', description:'Web サイトへの HTTP / HTTPS リクエストを、設定したルールに基づいて確認するサービスです。'},
  {title:'アクセスはどう判定される？', time:'75秒', lead:'リクエストを送ってみよう', description:'通常のアクセスと攻撃の特徴を持つアクセスを切り替え、どこで止まるかを確認します。'},
  {title:'ルールを変えるとどうなる？', time:'90秒', lead:'同じリクエストでも結果が変わる', description:'検知ルールを OFF にして、同じサンプルリクエストをもう一度送ってみましょう。'},
  {title:'まとめ', time:'45秒', lead:'AWS WAF はルールでアクセスをコントロール', description:'① リクエストを確認 ② ルールに照らして判断 ③ 許可またはブロック。'}
];

export default function App() {
  const [chapter, setChapter] = useState(0);
  const [kind, setKind] = useState<RequestKind>('normal');
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [step, setStep] = useState(-1);
  const [presenter, setPresenter] = useState(false);
  const result = useMemo(() => evaluateWaf(kind, ruleEnabled), [kind, ruleEnabled]);
  const changeRequest = (value: RequestKind) => {setKind(value); setStep(-1);};
  const changeRule = (value: boolean) => {setRuleEnabled(value); setStep(-1);};
  const advance = () => setStep(current => Math.min(current + 1, 3));
  const goChapter = (value: number) => {setChapter(Math.max(0, Math.min(3, value))); setStep(-1);};
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && e.altKey) goChapter(chapter + 1);
      if (e.key === 'ArrowLeft' && e.altKey) goChapter(chapter - 1);
      if (e.key === 'Escape') setPresenter(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [chapter]);
  const active = step >= 0;
  const blocked = active && step >= 2 && result.action === 'BLOCK';
  return <div className={`app ${presenter ? 'presenter' : ''}`}>
    <header className="topbar"><div className="brand"><ShieldCheck size={24}/><span>AWS <b>FlowLab</b></span><span className="version">v0.1</span></div><div className="header-actions"><span className="duration">初心者向け · 約5分</span><button className="ghost" onClick={() => setPresenter(!presenter)}><Expand size={16}/>{presenter ? '通常表示' : '発表モード'}</button></div></header>
    <main className="layout"><aside className="sidebar"><div className="eyebrow">LEARNING PATH</div><h2>AWS WAF Basics</h2><p className="muted">4つのステップで学ぼう</p><nav>{chapters.map((item,i) => <button key={i} className={`chapter ${chapter===i?'selected':''}`} onClick={() => goChapter(i)}><span className="chapter-number">0{i+1}</span><span><strong>{item.title}</strong><small>{item.time}</small></span></button>)}</nav><div className="sidebar-note"><CircleHelp size={18}/>実際の AWS リソースは使用しません。</div></aside>
    <section className="main"><div className="intro"><div className="eyebrow">CHAPTER 0{chapter+1} / 04</div><h1>{chapters[chapter].title}</h1><p className="lead">{chapters[chapter].lead}</p><p className="description">{chapters[chapter].description}</p></div>
      <div className="demo"><div className="demo-heading"><span className="live-dot"/> INTERACTIVE DEMO <span className="demo-hint">クリックして動きを確認</span></div>
        <div className="diagram"><div className={`node visitor ${active?'activated':''}`}><div className="node-icon">👤</div><strong>利用者</strong><small>HTTP Request</small></div><div className={`link ${step>=0?'flowing':''}`}><span className="particle"/><span className="link-label">リクエスト</span></div><div className={`node waf ${step>=1?'activated':''}`}><ShieldCheck size={42}/><strong>AWS WAF</strong><small>ルールをチェック</small>{step>=1 && <span className="check-pill">{result.matched?'MATCH':'CHECKED'}</span>}</div><div className={`link ${step>=3&&!blocked?'flowing':''} ${blocked?'blocked':''}`}><span className="particle"/><span className="link-label">{blocked?'BLOCK':'ALLOW ?'}</span></div><div className={`node website ${step===3&&!blocked?'activated':''} ${blocked?'disabled':''}`}><div className="node-icon">🌐</div><strong>Web サイト</strong><small>{blocked?'到達しない':step===3?'アクセス到達':'保護対象'}</small></div></div>
        <div className="controls"><div className="control-group"><label>アクセスの種類</label><div className="segmented"><button className={kind==='normal'?'active':''} onClick={() => changeRequest('normal')}>🙂 通常アクセス</button><button className={kind==='attack'?'active':''} onClick={() => changeRequest('attack')}>⚠️ 不正アクセス（例）</button></div></div><div className="control-group"><label htmlFor="rule">攻撃検知ルール</label><label className="toggle"><input id="rule" type="checkbox" checked={ruleEnabled} onChange={e=>changeRule(e.target.checked)}/><span className="switch"/><b>{ruleEnabled?'ON':'OFF'}</b></label></div></div>
        <div className="execution"><div className="execution-title"><strong>実行ステップ</strong><span>{step<0?'準備完了':`${step+1} / 4`}</span></div><div className="timeline">{result.trace.map((t,i)=><div key={i} className={`trace ${i===step?'current':''} ${i<step?'completed':''}`}><span className="trace-mark">{i<step?'✓':i+1}</span><div><strong>{t.title}</strong>{i===step&&<p>{t.detail}</p>}</div></div>)}</div><div className="demo-actions"><button className="primary" onClick={advance} disabled={step===3}>{step<0?'▶ リクエスト送信':step===3?'実行完了':'次のステップ →'}</button><button className="ghost" onClick={()=>setStep(-1)}><RotateCcw size={16}/>リセット</button></div></div>
        {step===3&&<div className={`result ${result.action==='BLOCK'?'danger':'success'}`}>{result.action==='BLOCK'?<ShieldX size={24}/>:<CheckCircle2 size={24}/>}<div><strong>最終結果：{result.action}</strong><p>{result.trace[3].detail}</p></div></div>}
      </div>
      <div className="lesson"><Sparkles size={18}/><p>{chapter===0?'AWS WAF は、Web サイトに届く前のリクエストをルールで確認します。':chapter===1?'不正アクセスを防ぐには、検知するためのルールが必要です。':chapter===2?'ルールを OFF にすると、この例では攻撃の特徴を持つリクエストも通過します。':'AWS WAF は万能ではありません。適切なルール設定と継続的な見直しが大切です。'}</p></div>
      <div className="navigation"><button className="ghost" disabled={chapter===0} onClick={()=>goChapter(chapter-1)}><ArrowLeft size={16}/>前へ</button><span>{chapter+1} / 4</span><button className="primary" disabled={chapter===3} onClick={()=>goChapter(chapter+1)}>次の章へ<ArrowRight size={16}/></button></div>
      <p className="disclaimer">※ 教育目的の簡易シミュレーションです。実際の検知結果は Web ACL のルール、優先順位、リクエスト内容などによって異なります。ルールが一致しない場合は Web ACL のデフォルト動作が適用されます。</p>
    </section></main>
  </div>;
}
