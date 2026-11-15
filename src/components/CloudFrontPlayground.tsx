import { useEffect, useState } from 'react';
import { Cloud } from 'lucide-react';
import { advanceTime, behaviorNames, createCacheKey, invalidationPatterns, invalidateCache, paths, selectBehavior, updateOrigin, type BehaviorId, type CloudFrontPath, type InvalidationPattern, type Language } from '../services/cloudfront/cloudfrontEngine';
import { advanceCloudFrontStep, createCloudFrontExecution, type CloudFrontExecution } from '../services/cloudfront/playback';
import { cloudFrontScenarios, createCloudFrontScenario } from '../services/cloudfront/scenarios';
import { CloudFrontFlow } from './CloudFrontFlow';
import { KnowledgeCards, PlaygroundPanel, ServiceOverview } from './Playground';
const knowledge = [
  { title: 'CloudFront とは？', text: '利用者に近いエッジで内容をキャッシュして配信する CDN です。Hit ならオリジンに戻らず応答できます。この画面では1つのエッジだけを扱います。' },
  { title: 'Hit / Miss', text: '同じキーの有効な内容があれば Hit。なければ Miss でオリジンへ進みます。TTL 0 の BYPASS はキャッシュしないことを示す学習用表示で、実際のレスポンスヘッダー名ではありません。' },
  { title: 'TTL', text: 'キャッシュが有効な時間です。このモデルはオリジンの Cache-Control ヘッダーがない成功応答に、設定した TTL を適用します。時間はボタンで進め、Hit では期限を延長しません。' },
  { title: 'Cache Key と lang', text: 'キーが同じならキャッシュを共有します。ここでは lang を常にオリジンへ転送します。言語で内容が変わる場合、lang をキーに含めないと、先に保存した別言語の内容が返ることがあります。' },
  { title: 'Cache Behavior', text: 'パスを上から比較し、最初に一致した設定を使います。/images/*、/api/*、最後に Default の固定順です。初期設定では画像を60秒キャッシュし、API はキャッシュしません。' },
  { title: 'Invalidation', text: 'TTL を待たずにキャッシュを無効化します。次のリクエストで再取得し、無効化だけでは取得しません。末尾 * は lang 別のキーも対象にします。ここでは即時完了ですが、実際の配信網への反映には時間がかかります。' },
];
export default function CloudFrontPlayground() {
  const [model, setModel] = useState(() => createCloudFrontScenario(0));
  const [scenario, setScenario] = useState<number | null>(0);
  const [execution, setExecution] = useState<CloudFrontExecution | null>(null);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [playbackId, setPlaybackId] = useState(0);
  const [notice, setNotice] = useState('');
  const [invalidation, setInvalidation] = useState<InvalidationPattern>('/index.html*');
  const { request, distribution, state } = model;
  const behaviorId = selectBehavior(request.path);
  const policy = distribution[behaviorId];
  const complete = execution?.result.events[step]?.phase === 'response';
  const current = execution?.result.events[step];
  const changed = () => { setPlaying(false); setDirty(true); setScenario(null); setNotice(''); };
  const loadScenario = (index: number) => { setModel(createCloudFrontScenario(index)); setScenario(index); setExecution(null); setStep(-1); setPlaying(false); setDirty(false); setNotice(''); setInvalidation('/index.html*'); };
  const send = (auto: boolean) => {
    const next = createCloudFrontExecution(request, distribution, state);
    setExecution(next); setModel(value => ({ ...value, state: next.result.nextState })); setStep(0); setPlaying(auto); setDirty(false); setNotice(''); setPlaybackId(id => id + 1);
  };
  const changePolicy = (id: BehaviorId, patch: Partial<typeof policy>) => { setModel(value => ({ ...value, distribution: { ...value.distribution, [id]: { ...value.distribution[id], ...patch } } })); changed(); };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); loadScenario(((scenario ?? 0) + (event.key === 'ArrowRight' ? 1 : -1) + cloudFrontScenarios.length) % cloudFrontScenarios.length); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [scenario]);
  useEffect(() => {
    if (!playing || !execution) return;
    if (step >= execution.result.events.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setStep(value => advanceCloudFrontStep(value, execution.result)), 950);
    return () => window.clearTimeout(timer);
  }, [playing, execution, step]);
  return <main className="playground"><ServiceOverview icon={<Cloud size={32}/>} title="Amazon CloudFront" category="NETWORKING · CONTENT DELIVERY" description="キャッシュで返す？ オリジンから取る？ 動かして確かめよう。" architecture="利用者 ⇄ CloudFront（キャッシュ）⇄ Origin"/>
    <PlaygroundPanel title="まずは例を選んでみよう" className="scenario-panel"><div className="scenario-grid cf-scenarios">{cloudFrontScenarios.map((item, index) => <button key={item.title} className={`scenario ${scenario === index ? 'selected' : ''}`} aria-pressed={scenario === index} onClick={() => loadScenario(index)}><span>0{index + 1}</span>{item.title}</button>)}</div><p className="muted">{scenario === null ? '設定を変えたら、再送信して比べましょう。' : cloudFrontScenarios[scenario].hint} 例の選択だけでは送信しません。Alt + ← / → で例を選べます。</p></PlaygroundPanel>
    <PlaygroundPanel title="リクエストの動きを見る" className="visualization"><CloudFrontFlow key={playbackId} execution={execution} step={step}/><div className="execution"><div className="execution-title"><strong>{execution ? `${step + 1} / ${execution.result.events.length}` : '同じリクエストを2回送ってみましょう'}</strong><span>{playing ? '再生中' : '準備完了'}</span></div>
    {dirty && execution && <p className="config-notice">設定や状態が変わりました。再送信で反映します。表示中の実行は前の結果です。</p>}
    <div className="demo-actions"><button className="primary" onClick={() => send(true)}>▶ リクエストを送信</button><button className="ghost" onClick={() => loadScenario(0)}>リセット</button></div><div aria-live="polite">{current && !complete && <div className="current-explanation"><strong>{current.title}</strong><p>{current.detail}</p></div>}</div>
    {complete && execution && <div className="result success" role="status"><div><strong>{execution.result.outcome === 'BYPASS' ? 'キャッシュなし（BYPASS）' : `Cache ${execution.result.outcome}`} → {execution.result.language.toUpperCase()} · v{execution.result.version}</strong><p>{current?.detail}</p><p>リクエスト言語：{execution.request.language.toUpperCase()} / 応答言語：{execution.result.language.toUpperCase()} / Cache Key：{execution.result.key}</p></div></div>}
    <details className="trace-history"><summary>ステップごとに確認・再生</summary><div className="demo-actions"><button className="ghost" onClick={() => { if (!execution || complete || dirty) send(false); else { setPlaying(false); setStep(advanceCloudFrontStep(step, execution.result)); } }}>次のステップ →</button><button className="ghost" disabled={!playing} onClick={() => setPlaying(false)}>一時停止</button><button className="ghost" disabled={!execution} onClick={() => { setStep(0); setPlaying(true); setPlaybackId(id => id + 1); }}>再生</button></div>{execution && <ol className="event-list">{execution.result.events.slice(0, step + 1).map((event, index) => <li key={index} className={index === step ? 'current' : ''}><span>{index + 1}</span><div><strong>{event.title}</strong>{index === step && <p>{event.detail}</p>}</div></li>)}</ol>}</details></div></PlaygroundPanel>
    <PlaygroundPanel title="リクエストとオリジン"><div className="basic-controls"><label>パス <select aria-label="リクエストのパス" value={request.path} onChange={event => { setModel(value => ({ ...value, request: { ...value.request, path: event.target.value as CloudFrontPath } })); changed(); }}>{paths.map(path => <option key={path}>{path}</option>)}</select></label><label>クエリ lang <select aria-label="クエリ lang" value={request.language} onChange={event => { setModel(value => ({ ...value, request: { ...value.request, language: event.target.value as Language } })); changed(); }}><option value="ja">ja（日本語）</option><option value="en">en（英語）</option></select></label><button className="ghost" onClick={() => { setModel(value => ({ ...value, state: advanceTime(value.state, 10) })); changed(); setNotice('シミュレーション時間を10秒進めました。'); }}>時間 +10秒</button><button className="ghost" onClick={() => { setModel(value => ({ ...value, state: updateOrigin(value.state, value.request.path) })); changed(); setNotice(`${request.path} のオリジンを更新。キャッシュはそのままです。`); }}>このパスのオリジンを更新</button></div>
    <p className="cf-summary">時刻：{state.now}秒 · 選択パスの Origin：v{state.originVersions[request.path]} · Behavior：{behaviorNames[behaviorId]} · 次回のキー：<code>{createCacheKey(request, policy)}</code></p>
    <div className="basic-controls"><label>無効化するパス <select aria-label="無効化するパス" value={invalidation} onChange={event => setInvalidation(event.target.value as InvalidationPattern)}>{invalidationPatterns.map(pattern => <option key={pattern}>{pattern}</option>)}</select></label><button className="ghost" onClick={() => { const next = invalidateCache(state, invalidation); setModel(value => ({ ...value, state: next })); changed(); setNotice(`Invalidation：${invalidation} の ${state.cache.length - next.cache.length} 件を無効化しました（即時完了の簡易モデル）。`); }}>Invalidation を実行</button></div><p className="cf-summary">lang は常にオリジンへ転送します。Invalidation は取得を行わず、次の送信時にオリジンから取得します。</p><p className="cf-summary" aria-live="polite">{notice}</p>
    <details className="advanced"><summary>キャッシュの設定</summary><div className="rule-editor"><p className="muted">固定順：/images/* → /api/* → Default。TTL はオリジンに Cache-Control がない場合の簡易設定です。TTL 0 はキャッシュ無効。変更は次回の取得から適用され、既存の期限は変わりません。</p>{(['images', 'api', 'default'] as const).map(id => <fieldset key={id}><legend>{behaviorNames[id]}</legend><label>TTL（秒）<input aria-label={`${behaviorNames[id]} TTL`} type="number" min="0" max="3600" step="1" value={distribution[id].ttl} onChange={event => { const ttl = Number(event.target.value); if (event.target.value !== '' && Number.isInteger(ttl) && ttl >= 0 && ttl <= 3600) changePolicy(id, { ttl }); }}/></label><label><input aria-label={`${behaviorNames[id]} lang をキーに含める`} type="checkbox" checked={distribution[id].includeLanguage} onChange={event => changePolicy(id, { includeLanguage: event.target.checked })}/>lang をキーに含める</label></fieldset>)}<p className="muted">TTL の入力範囲 0〜3600秒はこの教材の制限です。設定変更は即時反映するモデルで、実際の配信設定の反映待ちは再現しません。</p></div></details></PlaygroundPanel>
    <PlaygroundPanel title="キャッシュをのぞく"><p className="cf-summary">送信後のキャッシュ · 時刻 {state.now}秒。時間は「時間 +10秒」でのみ進みます。</p><div className="cf-cache-scroll"><table className="cf-cache"><caption className="visually-hidden">キャッシュキー、内容、残り TTL</caption><thead><tr><th scope="col">Cache Key</th><th scope="col">保存した内容</th><th scope="col">残り TTL</th></tr></thead><tbody>{state.cache.length === 0 ? <tr><td colSpan={3}>キャッシュは空です。</td></tr> : state.cache.map(entry => <tr key={entry.key}><th scope="row"><code>{entry.key}</code></th><td>{entry.language.toUpperCase()} · v{entry.version}</td><td>{entry.expiresAt > state.now ? `${entry.expiresAt - state.now}秒` : '期限切れ'}</td></tr>)}</tbody></table></div></PlaygroundPanel>
    <PlaygroundPanel title="気になることから学ぶ"><KnowledgeCards cards={knowledge}/></PlaygroundPanel><p className="disclaimer">※ 教育用の簡易モデルです。AWS 接続・HTTP 通信・課金は発生しません。単一エッジ、固定の GET / 200 応答を扱います。ヘッダー、Cookie、ブラウザーキャッシュ、条件付き再検証（304）、複数エッジ、段階的な設定反映は再現しません。Invalidation は即時完了のモデルです。設定とキャッシュはメモリー内のみです。</p>
  </main>;
}
