import { describe, expect, it } from 'vitest';
import { createDefaultListener, evaluateAlb, matchesPath } from './albEngine';
import { advanceAlbStep, createAlbExecution } from './playback';
describe('ALB listener evaluation', () => {
  it('routes default, API and images paths without changing inputs or the request path', () => {
    const listener = createDefaultListener(); const before = JSON.stringify(listener);
    expect(evaluateAlb('/', listener).targetGroupId).toBe('web');
    expect(evaluateAlb('/help', listener).events.some(event => event.phase === 'default')).toBe(true);
    expect(evaluateAlb('/api/users', listener).targetGroupId).toBe('api');
    expect(evaluateAlb('/images/logo.png', listener).targetGroupId).toBe('images');
    expect(JSON.stringify(listener)).toBe(before);
    expect(createAlbExecution('/api/users', listener).path).toBe('/api/users');
  });
  it('matches fixed wildcard prefixes case-sensitively and respects slash boundaries', () => {
    expect(matchesPath('/api/', '/api/*')).toBe(true);
    expect(matchesPath('/api/users/42', '/api/*')).toBe(true);
    expect(matchesPath('/api', '/api/*')).toBe(false);
    expect(matchesPath('/apiary/users', '/api/*')).toBe(false);
    expect(matchesPath('/API/users', '/api/*')).toBe(false);
    expect(matchesPath('/', '/*')).toBe(true);
  });
  it('stops at the first match and priority changes the overlapping winner', () => {
    const listener = createDefaultListener(); listener.rules[2].enabled = true;
    const result = evaluateAlb('/api/users', listener);
    expect(result.matchedRuleId).toBe('api');
    expect(result.events.filter(event => event.phase === 'rule').map(event => event.ruleId)).toEqual(['api']);
    listener.rules[2].priority = 1; listener.rules.reverse();
    expect(evaluateAlb('/api/users', listener).targetGroupId).toBe('web');
    expect(evaluateAlb('/api/users', listener).matchedRuleId).toBe('all');
  });
  it('skips disabled rules and uses the configured default or rule target', () => {
    const listener = createDefaultListener(); listener.rules.forEach(rule => { rule.enabled = false; }); listener.defaultTargetGroupId = 'images';
    const result = evaluateAlb('/api/users', listener);
    expect(result.targetGroupId).toBe('images'); expect(result.matchedRuleId).toBeUndefined();
    expect(result.events.filter(event => event.phase === 'rule').every(event => event.status === 'DISABLED')).toBe(true);
    listener.rules[0].enabled = true; listener.rules[0].targetGroupId = 'web';
    expect(evaluateAlb('/api/users', listener).targetGroupId).toBe('web');
    listener.rules = []; expect(evaluateAlb('/', listener).targetGroupId).toBe('images');
  });
  it.each([0, -1, 1.5, 50001, Infinity, NaN])('rejects invalid priority %s', priority => {
    const listener = createDefaultListener(); listener.rules[0].priority = priority;
    expect(() => evaluateAlb('/', listener)).toThrow('Invalid listener rule');
  });
  it('rejects duplicate priorities, IDs, unsupported targets, conditions and path input', () => {
    const listener = createDefaultListener(); listener.rules[1].priority = 10;
    expect(() => evaluateAlb('/', listener)).toThrow();
    listener.rules[1].priority = 20; listener.rules[1].id = 'api'; expect(() => evaluateAlb('/', listener)).toThrow();
    expect(() => evaluateAlb('/', { ...createDefaultListener(), defaultTargetGroupId: 'missing' } as never)).toThrow();
    const invalid = createDefaultListener(); invalid.rules[0].pathPattern = '/other/*' as never;
    expect(() => evaluateAlb('/', invalid)).toThrow();
    for (const path of ['api/users', 'https://example.com/', '/api/users?x=1', '/../']) expect(() => evaluateAlb(path, createDefaultListener())).toThrow();
  });
  it('snapshots configuration and clamps playback at the final event', () => {
    const listener = createDefaultListener(); const execution = createAlbExecution('/api/users', listener);
    listener.rules[0].enabled = false; listener.defaultTargetGroupId = 'images';
    expect(execution.listener.rules[0].enabled).toBe(true); expect(execution.result.targetGroupId).toBe('api');
    expect(advanceAlbStep(0, execution.result)).toBe(1);
    const last = execution.result.events.length - 1; expect(advanceAlbStep(last, execution.result)).toBe(last);
  });
});
