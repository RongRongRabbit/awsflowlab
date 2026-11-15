export const paths = ['/index.html', '/images/logo.png', '/api/users'] as const;
export type CloudFrontPath = typeof paths[number];
export type Language = 'ja' | 'en';
export type BehaviorId = 'images' | 'api' | 'default';
export type CachePolicy = { ttl: number; includeLanguage: boolean };
export type Distribution = Record<BehaviorId, CachePolicy>;
export type ViewerRequest = { path: CloudFrontPath; language: Language };
export type CachedObject = { key: string; path: CloudFrontPath; language: Language; version: number; expiresAt: number };
export type EdgeState = { now: number; originVersions: Record<CloudFrontPath, number>; cache: CachedObject[] };
export type CacheOutcome = 'HIT' | 'MISS' | 'BYPASS';
export type CloudFrontEvent = { phase: 'request' | 'behavior' | 'lookup' | 'origin-request' | 'origin' | 'store' | 'response'; title: string; detail: string };
export type CloudFrontResult = { outcome: CacheOutcome; behaviorId: BehaviorId; key: string; language: Language; version: number; originFetched: boolean; events: CloudFrontEvent[]; nextState: EdgeState };
export const behaviorNames: Record<BehaviorId, string> = { images: '/images/*', api: '/api/*', default: 'Default (*)' };
export function createDistribution(): Distribution {
  return { images: { ttl: 60, includeLanguage: false }, api: { ttl: 0, includeLanguage: false }, default: { ttl: 30, includeLanguage: false } };
}
export function createEdgeState(): EdgeState {
  return { now: 0, originVersions: { '/index.html': 1, '/images/logo.png': 1, '/api/users': 1 }, cache: [] };
}
export function copyEdgeState(state: EdgeState): EdgeState {
  return { ...state, originVersions: { ...state.originVersions }, cache: state.cache.map(entry => ({ ...entry })) };
}
export function validateDistribution(distribution: Distribution): void {
  for (const id of ['images', 'api', 'default'] as const) {
    const policy = distribution[id];
    if (!policy || !Number.isInteger(policy.ttl) || policy.ttl < 0 || policy.ttl > 3600 || typeof policy.includeLanguage !== 'boolean') throw new Error('Invalid cache policy');
  }
}
export function selectBehavior(path: CloudFrontPath): BehaviorId {
  return path.startsWith('/images/') ? 'images' : path.startsWith('/api/') ? 'api' : 'default';
}
export function createCacheKey(request: ViewerRequest, policy: CachePolicy): string {
  return request.path + (policy.includeLanguage ? `?lang=${request.language}` : '');
}
/** A single edge and origin. All lang values are forwarded to the origin, even when excluded from the key. */
export function evaluateCloudFront(request: ViewerRequest, distribution: Distribution, state: EdgeState): CloudFrontResult {
  validateDistribution(distribution);
  if (!paths.includes(request.path) || !['ja', 'en'].includes(request.language)) throw new Error('Invalid viewer request');
  const behaviorId = selectBehavior(request.path);
  const policy = distribution[behaviorId];
  const key = createCacheKey(request, policy);
  const nextState = copyEdgeState(state);
  const entry = state.cache.find(item => item.key === key);
  const outcome: CacheOutcome = policy.ttl === 0 ? 'BYPASS' : entry && state.now < entry.expiresAt ? 'HIT' : 'MISS';
  const version = outcome === 'HIT' ? entry!.version : state.originVersions[request.path];
  const language = outcome === 'HIT' ? entry!.language : request.language;
  const events: CloudFrontEvent[] = [
    { phase: 'request', title: `GET ${request.path}?lang=${request.language}`, detail: '利用者から1つのエッジキャッシュへリクエストを送ります。実際の HTTP 通信は行いません。' },
    { phase: 'behavior', title: `Behavior：${behaviorNames[behaviorId]}`, detail: `パスで Behavior を選びます。${policy.ttl === 0 ? 'TTL 0秒：キャッシュしない設定です。' : `TTL ${policy.ttl}秒。`} lang は${policy.includeLanguage ? 'キャッシュキーに含めます。' : 'キーに含めません。'}` },
    { phase: 'lookup', title: outcome === 'BYPASS' ? 'キャッシュ無効（BYPASS）' : `Cache ${outcome}`, detail: outcome === 'HIT' ? `${key} は有効です。オリジンの更新に関係なく、保存した内容を返します。` : outcome === 'BYPASS' ? 'この Behavior は毎回オリジンへ進みます。BYPASS は学習用の表示です。' : entry ? `${key} の TTL が切れています。オリジンから再取得します。` : `${key} はまだ保存されていません。オリジンへ進みます。` },
  ];
  if (outcome !== 'HIT') {
    events.push({ phase: 'origin-request', title: 'CloudFront → Origin', detail: 'キャッシュから返せないため、オリジンへ取得リクエストを送ります。' });
    events.push({ phase: 'origin', title: `Origin → ${language.toUpperCase()} · v${version}`, detail: 'lang は常にオリジンへ渡します。選んだパスと言語の内容を取得します。' });
    if (policy.ttl > 0) {
      const stored: CachedObject = { key, path: request.path, language, version, expiresAt: state.now + policy.ttl };
      nextState.cache = [...nextState.cache.filter(item => item.key !== key), stored];
      events.push({ phase: 'store', title: `キャッシュに保存 · ${policy.ttl}秒`, detail: `期限はシミュレーション時刻 ${stored.expiresAt}秒です。Hit では期限を延ばしません。` });
    }
  }
  events.push({ phase: 'response', title: `利用者へ ${language.toUpperCase()} · v${version}`, detail: outcome === 'HIT' ? 'キャッシュから応答。オリジンへのアクセスはありません。' : policy.ttl === 0 ? 'オリジンから応答。この内容はキャッシュに保存しません。' : '取得した内容を利用者へ返します。次の同じキーのリクエストは、有効期間内なら Hit になります。' });
  return { outcome, behaviorId, key, language, version, originFetched: outcome !== 'HIT', events, nextState };
}
export function advanceTime(state: EdgeState, seconds: number): EdgeState {
  if (!Number.isInteger(seconds) || seconds < 0 || !Number.isSafeInteger(state.now + seconds)) throw new Error('Invalid time increment');
  return { ...copyEdgeState(state), now: state.now + seconds };
}
export function updateOrigin(state: EdgeState, path: CloudFrontPath): EdgeState {
  if (!paths.includes(path)) throw new Error('Invalid origin path');
  const next = copyEdgeState(state); next.originVersions[path] += 1; return next;
}
export const invalidationPatterns = ['/index.html*', '/images/*', '/api/*', '/*'] as const;
export type InvalidationPattern = typeof invalidationPatterns[number];
/** Instant completion is a teaching simplification; trailing * also removes query-key variants. */
export function invalidateCache(state: EdgeState, pattern: InvalidationPattern): EdgeState {
  if (!invalidationPatterns.includes(pattern)) throw new Error('Invalid invalidation pattern');
  const next = copyEdgeState(state); next.cache = next.cache.filter(entry => !entry.key.startsWith(pattern.slice(0, -1))); return next;
}
