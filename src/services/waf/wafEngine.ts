export type RequestKind = 'normal' | 'attack';
export type WafAction = 'ALLOW' | 'BLOCK';
export type RuleAction = WafAction | 'COUNT';
export type Condition = 'attack' | 'all';
export type Rule = { id: string; name: string; enabled: boolean; condition: Condition; action: RuleAction; priority: number };
export type WebAcl = { rules: Rule[]; defaultAction: WafAction };
export type WafEvent = { phase: 'request' | 'rule' | 'default' | 'destination'; ruleId?: string; status?: 'MATCH' | 'NO MATCH' | 'DISABLED'; action?: RuleAction; title: string; detail: string };
export type WafResult = { action: WafAction; events: WafEvent[]; countedRuleIds: string[]; terminatingRuleId?: string };

export function createDefaultAcl(): WebAcl {
  return { defaultAction: 'ALLOW', rules: [
    { id: 'attack', name: '攻撃の特徴を確認', enabled: true, condition: 'attack', action: 'BLOCK', priority: 10 },
    { id: 'all', name: 'すべてのサンプルを確認', enabled: true, condition: 'all', action: 'ALLOW', priority: 20 },
  ] };
}
export function validateAcl(acl: WebAcl): void {
  if (!['ALLOW', 'BLOCK'].includes(acl.defaultAction)) throw new Error('Invalid default action');
  const priorities = new Set<number>();
  const ids = new Set<string>();
  for (const rule of acl.rules) {
    if (!Number.isInteger(rule.priority) || rule.priority < 0 || priorities.has(rule.priority)) throw new Error('Priority must be a unique non-negative integer');
    if (!rule.id || ids.has(rule.id)) throw new Error('Rule IDs must be unique');
    if (!['ALLOW', 'BLOCK', 'COUNT'].includes(rule.action) || !['attack', 'all'].includes(rule.condition)) throw new Error('Invalid rule');
    priorities.add(rule.priority); ids.add(rule.id);
  }
}
export function matchesCondition(kind: RequestKind, condition: Condition): boolean {
  return condition === 'all' || kind === 'attack';
}
/** Deterministic teaching model; no HTTP parsing or AWS calls. */
export function evaluateWaf(kind: RequestKind, acl: WebAcl): WafResult {
  validateAcl(acl);
  const events: WafEvent[] = [{ phase: 'request', title: 'リクエストを送信', detail: kind === 'normal' ? '通常のページ閲覧サンプルです。' : '攻撃の特徴を持つサンプルです。実際の攻撃は送信しません。' }];
  const countedRuleIds: string[] = [];
  let action: WafAction | undefined;
  let terminatingRuleId: string | undefined;
  for (const rule of [...acl.rules].sort((a, b) => a.priority - b.priority)) {
    const matched = rule.enabled && matchesCondition(kind, rule.condition);
    const status = !rule.enabled ? 'DISABLED' : matched ? 'MATCH' : 'NO MATCH';
    events.push({ phase: 'rule', ruleId: rule.id, status, action: matched ? rule.action : undefined, title: rule.name,
      detail: !rule.enabled ? 'OFF のため、条件を確認せず次へ進みます。' : !matched ? '条件に一致しません。次のルールへ進みます。' : rule.action === 'COUNT' ? '一致を記録します。判定は終わらず、次のルールへ進みます。' : `${rule.action} で判定を終了します。後のルールは確認しません。` });
    if (!matched) continue;
    if (rule.action === 'COUNT') { countedRuleIds.push(rule.id); continue; }
    action = rule.action; terminatingRuleId = rule.id; break;
  }
  if (!action) {
    action = acl.defaultAction;
    events.push({ phase: 'default', action, title: `Default Action：${action}`, detail: 'Allow / Block を決めるルールがなかったため、Web ACL のデフォルト動作を使います。' });
  }
  events.push({ phase: 'destination', action, title: `最終結果：${action}`, detail: action === 'BLOCK' ? 'WAF でブロック。Web サイトには届きません。' : 'WAF を通過し、Web サイトへ進みます。' });
  return { action, events, countedRuleIds, terminatingRuleId };
}
