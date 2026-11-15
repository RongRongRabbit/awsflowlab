import { describe, expect, it } from 'vitest';
import { advanceTime, createCacheKey, createDistribution, createEdgeState, evaluateCloudFront, invalidateCache, selectBehavior, updateOrigin, type ViewerRequest } from './cloudfrontEngine';
import { advanceCloudFrontStep, createCloudFrontExecution } from './playback';
import { createCloudFrontScenario } from './scenarios';
const request: ViewerRequest = { path: '/index.html', language: 'ja' };
describe('CloudFront cache model', () => {
  it('starts with a miss, stores a response and hits without fetching or renewing TTL', () => {
    const config = createDistribution(); const state = createEdgeState(); const original = JSON.stringify({ state, config });
    const miss = evaluateCloudFront(request, config, state);
    expect(miss.outcome).toBe('MISS'); expect(miss.originFetched).toBe(true); expect(miss.nextState.cache[0].expiresAt).toBe(30);
    expect(JSON.stringify({ state, config })).toBe(original);
    const hit = evaluateCloudFront(request, config, advanceTime(miss.nextState, 10));
    expect(hit.outcome).toBe('HIT'); expect(hit.originFetched).toBe(false); expect(hit.nextState.cache[0].expiresAt).toBe(30);
    expect(hit.events.some(event => ['origin', 'store'].includes(event.phase))).toBe(false);
  });
  it('keeps old contents after origin updates and fetches new contents exactly at expiry', () => {
    const config = createDistribution(); const stored = evaluateCloudFront(request, config, createEdgeState()).nextState;
    const updated = updateOrigin(stored, request.path);
    expect(stored.originVersions[request.path]).toBe(1);
    expect(evaluateCloudFront(request, config, advanceTime(updated, 29)).version).toBe(1);
    const expired = evaluateCloudFront(request, config, advanceTime(updated, 30));
    expect(expired.outcome).toBe('MISS'); expect(expired.version).toBe(2); expect(expired.nextState.cache).toHaveLength(1);
    expect(expired.nextState.cache[0].expiresAt).toBe(60);
  });
  it('shows shared-key language collisions and separates languages when configured', () => {
    const config = createDistribution(); const stored = evaluateCloudFront(request, config, createEdgeState()).nextState;
    const english: ViewerRequest = { ...request, language: 'en' };
    const collision = evaluateCloudFront(english, config, stored);
    expect(collision.outcome).toBe('HIT'); expect(collision.language).toBe('ja');
    config.default.includeLanguage = true;
    const englishMiss = evaluateCloudFront(english, config, stored);
    expect(englishMiss.outcome).toBe('MISS'); expect(englishMiss.language).toBe('en'); expect(englishMiss.key).toBe('/index.html?lang=en');
    const japaneseMiss = evaluateCloudFront(request, config, englishMiss.nextState);
    expect(japaneseMiss.outcome).toBe('MISS'); expect(japaneseMiss.language).toBe('ja');
    expect(evaluateCloudFront(english, config, japaneseMiss.nextState).outcome).toBe('HIT');
    expect(createCacheKey(request, config.default)).toBe('/index.html?lang=ja');
  });
  it('chooses behaviors by path and bypasses API caching even when lang or old cache entries exist', () => {
    const config = createDistribution(); const api: ViewerRequest = { path: '/api/users', language: 'en' };
    const bypass = evaluateCloudFront(api, config, createEdgeState());
    expect(bypass.behaviorId).toBe('api'); expect(bypass.outcome).toBe('BYPASS'); expect(bypass.nextState.cache).toHaveLength(0);
    expect(evaluateCloudFront(api, config, bypass.nextState).originFetched).toBe(true);
    config.api.ttl = 10;
    const cached = evaluateCloudFront(api, config, bypass.nextState).nextState;
    config.api.ttl = 0; expect(evaluateCloudFront(api, config, cached).outcome).toBe('BYPASS');
    const image = evaluateCloudFront({ path: '/images/logo.png', language: 'ja' }, config, cached);
    expect(image.behaviorId).toBe('images'); expect(image.nextState.cache.find(entry => entry.path === '/images/logo.png')?.expiresAt).toBe(60);
    expect(selectBehavior('/index.html')).toBe('default');
  });
  it('preserves old expiry when TTL is changed and applies new TTL on the next origin fetch', () => {
    const config = createDistribution(); const stored = evaluateCloudFront(request, config, createEdgeState()).nextState;
    config.default.ttl = 100;
    expect(evaluateCloudFront(request, config, stored).nextState.cache[0].expiresAt).toBe(30);
    expect(evaluateCloudFront(request, config, advanceTime(stored, 30)).nextState.cache[0].expiresAt).toBe(130);
  });
  it('invalidates chosen paths and all language variants without fetching or changing origin/time', () => {
    const config = createDistribution(); config.default.includeLanguage = true;
    let state = evaluateCloudFront(request, config, createEdgeState()).nextState;
    state = evaluateCloudFront({ ...request, language: 'en' }, config, state).nextState;
    state = evaluateCloudFront({ path: '/images/logo.png', language: 'ja' }, config, state).nextState;
    const original = JSON.stringify(state);
    const invalidated = invalidateCache(state, '/index.html*');
    expect(invalidated.cache).toHaveLength(1); expect(invalidated.cache[0].path).toBe('/images/logo.png');
    expect(invalidated.originVersions).toEqual(state.originVersions); expect(invalidated.now).toBe(state.now);
    expect(JSON.stringify(state)).toBe(original);
    expect(evaluateCloudFront(request, config, invalidated).outcome).toBe('MISS');
    expect(invalidateCache(state, '/*').cache).toHaveLength(0);
    expect(invalidateCache(state, '/api/*').cache).toHaveLength(3);
    expect(invalidateCache(state, '/images/*').cache).toHaveLength(2);
  });
  it('isolates origin updates by path and does not mutate cache data', () => {
    const state = evaluateCloudFront(request, createDistribution(), createEdgeState()).nextState;
    const updated = updateOrigin(state, '/images/logo.png');
    expect(updated.originVersions['/index.html']).toBe(1); expect(updated.originVersions['/images/logo.png']).toBe(2);
    expect(updated.cache).toEqual(state.cache); expect(updated.cache[0]).not.toBe(state.cache[0]);
  });
  it('uses independent snapshots and replay does not run a second cache evaluation', () => {
    const config = createDistribution(); const state = createEdgeState(); const input = { ...request };
    const execution = createCloudFrontExecution(input, config, state);
    config.default.ttl = 0; state.originVersions['/index.html'] = 99; input.language = 'en';
    expect(execution.distribution.default.ttl).toBe(30); expect(execution.before.originVersions['/index.html']).toBe(1);
    expect(execution.request.language).toBe('ja'); expect(execution.result.version).toBe(1);
    const original = JSON.stringify(execution); const last = execution.result.events.length - 1;
    expect(advanceCloudFrontStep(0, execution.result)).toBe(1); expect(advanceCloudFrontStep(last, execution.result)).toBe(last);
    expect(JSON.stringify(execution)).toBe(original);
  });
  it.each([-1, 1.5, 3601, Infinity, NaN])('rejects invalid teaching TTL %s', ttl => {
    const config = createDistribution(); config.default.ttl = ttl;
    expect(() => evaluateCloudFront(request, config, createEdgeState())).toThrow('Invalid cache policy');
  });
  it('validates requests, time increments and invalidation patterns', () => {
    const state = createEdgeState(); const config = createDistribution();
    expect(() => evaluateCloudFront({ path: '/other', language: 'ja' } as never, config, state)).toThrow();
    expect(() => evaluateCloudFront({ ...request, language: 'fr' } as never, config, state)).toThrow();
    for (const seconds of [-1, 0.5, Infinity, NaN]) expect(() => advanceTime(state, seconds)).toThrow();
    expect(() => invalidateCache(state, '/index.html' as never)).toThrow();
    expect(() => updateOrigin(state, '/other' as never)).toThrow();
    expect(advanceTime(state, 0)).toEqual(state);
  });
  it('prepares six independent scenarios with no visible execution or cross-scenario state', () => {
    const outcomes = ['MISS', 'HIT', 'HIT', 'HIT', 'BYPASS', 'HIT'];
    for (let index = 0; index < 6; index++) {
      const sample = createCloudFrontScenario(index);
      expect(evaluateCloudFront(sample.request, sample.distribution, sample.state).outcome).toBe(outcomes[index]);
    }
    const expires = createCloudFrontScenario(2);
    expect(evaluateCloudFront(expires.request, expires.distribution, advanceTime(expires.state, 10)).version).toBe(2);
    const first = createCloudFrontScenario(0); first.state.originVersions['/index.html'] = 50;
    expect(createCloudFrontScenario(0).state.originVersions['/index.html']).toBe(1);
  });
});
