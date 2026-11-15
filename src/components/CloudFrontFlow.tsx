import type { CloudFrontExecution } from '../services/cloudfront/playback';
export function CloudFrontFlow({ execution, step }: { execution: CloudFrontExecution | null; step: number }) {
  const event = execution?.result.events[step];
  const hit = execution?.result.outcome === 'HIT';
  const response = event?.phase === 'response';
  const fromOrigin = event?.phase === 'origin';
  const toOrigin = event?.phase === 'origin-request';
  return <div className="flow-scroll"><div className="cf-diagram" aria-label="CloudFront のリクエストの流れ">
    <div className={`node ${event?.phase === 'request' || response ? 'activated' : ''}`}><strong>利用者</strong><small>{execution ? `${execution.request.path}?lang=${execution.request.language}` : 'GET Request'}</small>{response && <b>{execution?.result.language.toUpperCase()} · v{execution?.result.version}</b>}</div>
    <div className={`link ${event?.phase === 'request' || response ? 'flowing' : ''} ${response ? 'returning' : ''}`}><span key={event?.phase} className="particle"/><span className="link-label">{response ? '← Response' : 'Request →'}</span></div>
    <div className={`node cf-edge ${event && !fromOrigin ? 'activated' : ''}`}><strong>CloudFront</strong><small>単一のエッジキャッシュ</small><b>{event?.phase === 'lookup' || response ? execution?.result.outcome : event?.phase === 'store' ? '保存' : '判定'}</b></div>
    <div className={`link ${fromOrigin ? 'flowing returning' : toOrigin ? 'flowing' : ''}`}><span key={event?.phase} className="particle"/><span className="link-label">{fromOrigin ? '← 取得' : toOrigin ? 'Request →' : response && hit ? '取得なし' : 'Origin'}</span></div>
    <div className={`node ${fromOrigin || toOrigin ? 'activated' : response && hit ? 'disabled' : ''}`}><strong>Origin</strong><small>パスと言語ごとの内容</small>{fromOrigin && <b>{execution?.result.language.toUpperCase()} · v{execution?.result.version}</b>}</div>
  </div></div>;
}
