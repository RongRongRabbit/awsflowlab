import { describe, expect, it } from 'vitest';
import { createDefaultAcl, evaluateWaf, validateAcl } from './wafEngine';
import { advanceStep, createExecution } from './playback';
describe('WAF evaluation', () => {
  it.each([['normal', true, 'ALLOW'], ['normal', false, 'ALLOW'], ['attack', true, 'BLOCK'], ['attack', false, 'ALLOW']] as const)('preserves v0.1 %s enabled=%s', (kind, enabled, action) => {
    const acl = createDefaultAcl(); acl.rules = [acl.rules[0]]; acl.rules[0].enabled = enabled;
    expect(evaluateWaf(kind, acl).action).toBe(action);
  });
  it('terminates on Block and does not inspect subsequent rules', () => {
    const result = evaluateWaf('attack', createDefaultAcl());
    expect(result.terminatingRuleId).toBe('attack'); expect(result.events.filter(e => e.phase === 'rule')).toHaveLength(1);
  });
  it('overlapping Allow before Block changes outcome', () => {
    const acl = createDefaultAcl(); acl.rules[1].priority = 0;
    const result = evaluateWaf('attack', acl); expect(result.action).toBe('ALLOW'); expect(result.terminatingRuleId).toBe('all'); expect(result.events).not.toContainEqual(expect.objectContaining({ ruleId: 'attack' }));
  });
  it('Count continues to a later Block', () => {
    const acl = createDefaultAcl(); acl.rules[0].action = 'COUNT'; acl.rules[1].action = 'BLOCK';
    const result = evaluateWaf('attack', acl); expect(result.action).toBe('BLOCK'); expect(result.countedRuleIds).toEqual(['attack']); expect(result.events.filter(e => e.phase === 'rule')).toHaveLength(2);
  });
  it.each(['ALLOW', 'BLOCK'] as const)('Count-only falls back to %s', action => {
    const acl = createDefaultAcl(); acl.rules.forEach(rule => { rule.action = 'COUNT'; }); acl.defaultAction = action;
    const result = evaluateWaf('attack', acl); expect(result.action).toBe(action); expect(result.countedRuleIds).toHaveLength(2); expect(result.events[result.events.length - 2]?.phase).toBe('default');
  });
  it('disabled rules are skipped without a match', () => {
    const acl = createDefaultAcl(); acl.rules.forEach(rule => { rule.enabled = false; }); acl.defaultAction = 'BLOCK';
    const result = evaluateWaf('normal', acl); expect(result.action).toBe('BLOCK'); expect(result.events.filter(e => e.phase === 'rule').map(e => e.status)).toEqual(['DISABLED', 'DISABLED']);
  });
  it('No Match continues to the next rule', () => {
    const result = evaluateWaf('normal', createDefaultAcl()); expect(result.events[1].status).toBe('NO MATCH'); expect(result.events[2].status).toBe('MATCH'); expect(result.action).toBe('ALLOW');
  });
  it('empty ACL applies default action', () => expect(evaluateWaf('normal', { rules: [], defaultAction: 'BLOCK' }).action).toBe('BLOCK'));
  it('rejects duplicate, negative, fractional priorities and duplicate IDs', () => {
    for (const priority of [20, -1, 1.5]) { const acl = createDefaultAcl(); acl.rules[0].priority = priority; expect(() => validateAcl(acl)).toThrow(); }
    const acl = createDefaultAcl(); acl.rules[1].id = 'attack'; expect(() => validateAcl(acl)).toThrow();
  });
  it('does not mutate configuration', () => { const acl = createDefaultAcl(); const before = JSON.stringify(acl); evaluateWaf('attack', acl); expect(JSON.stringify(acl)).toBe(before); });
  it('execution snapshot and playback follow exactly the evaluated events', () => {
    const acl = createDefaultAcl(); const execution = createExecution('attack', acl); acl.rules[0].action = 'ALLOW';
    expect(execution.result.action).toBe('BLOCK'); expect(execution.acl.rules[0].action).toBe('BLOCK');
    let step = -1; const visited = []; for (let i = 0; i < execution.result.events.length; i++) { step = advanceStep(step, execution.result); visited.push(execution.result.events[step]); }
    expect(visited).toEqual(execution.result.events); expect(advanceStep(step, execution.result)).toBe(step);
  });
});
