export const targetGroups = [
  { id: 'web', name: 'Web Target Group', application: 'Web アプリ' },
  { id: 'api', name: 'API Target Group', application: 'API アプリ' },
  { id: 'images', name: 'Images Target Group', application: '画像アプリ' },
] as const;
export type TargetGroupId = typeof targetGroups[number]['id'];
export type PathPattern = '/api/*' | '/images/*' | '/*';
export type AlbRule = { id: string; name: string; enabled: boolean; priority: number; pathPattern: PathPattern; targetGroupId: TargetGroupId };
export type Listener = { rules: AlbRule[]; defaultTargetGroupId: TargetGroupId };
export type AlbEvent = { phase: 'request' | 'rule' | 'default' | 'forward' | 'destination'; title: string; detail: string; ruleId?: string; status?: 'MATCH' | 'NO MATCH' | 'DISABLED'; targetGroupId?: TargetGroupId };
export type AlbResult = { targetGroupId: TargetGroupId; matchedRuleId?: string; events: AlbEvent[] };
export function createDefaultListener(): Listener {
  return { defaultTargetGroupId: 'web', rules: [
    { id: 'api', name: 'API パス', enabled: true, priority: 10, pathPattern: '/api/*', targetGroupId: 'api' },
    { id: 'images', name: '画像パス', enabled: true, priority: 20, pathPattern: '/images/*', targetGroupId: 'images' },
    { id: 'all', name: '全パス', enabled: false, priority: 30, pathPattern: '/*', targetGroupId: 'web' },
  ] };
}
export function validateListener(listener: Listener): void {
  const validTarget = (id: string) => targetGroups.some(group => group.id === id);
  if (!validTarget(listener.defaultTargetGroupId)) throw new Error('Invalid default target group');
  const priorities = new Set<number>();
  const ids = new Set<string>();
  for (const rule of listener.rules) {
    if (!rule.id || ids.has(rule.id) || typeof rule.enabled !== 'boolean' || !Number.isInteger(rule.priority) || rule.priority < 1 || rule.priority > 50000 || priorities.has(rule.priority) || !['/api/*', '/images/*', '/*'].includes(rule.pathPattern) || !validTarget(rule.targetGroupId)) throw new Error('Invalid listener rule');
    priorities.add(rule.priority); ids.add(rule.id);
  }
}
/** Fixed, case-sensitive prefix patterns; samples are paths, not full URLs. */
export function matchesPath(path: string, pattern: PathPattern): boolean {
  return path.startsWith(pattern.slice(0, -1));
}
/** Pure teaching model: first matching forward rule wins; default is last. */
export function evaluateAlb(path: string, listener: Listener): AlbResult {
  validateListener(listener);
  if (!/^\/[A-Za-z0-9/_\.\-]*$/.test(path) || path.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('Use a simple absolute path without query strings');
  const events: AlbEvent[] = [{ phase: 'request', title: `GET ${path}`, detail: 'HTTP リクエストのパスを Listener で確認します。実際の通信は行いません。' }];
  let targetGroupId = listener.defaultTargetGroupId;
  let matchedRuleId: string | undefined;
  for (const rule of [...listener.rules].sort((a, b) => a.priority - b.priority)) {
    const matched = rule.enabled && matchesPath(path, rule.pathPattern);
    const status = !rule.enabled ? 'DISABLED' : matched ? 'MATCH' : 'NO MATCH';
    events.push({ phase: 'rule', ruleId: rule.id, status, title: rule.name,
      detail: !rule.enabled ? 'このモデルでは OFF のルールを評価対象から外します。次へ進みます。' : matched ? `${rule.pathPattern} に一致。Forward で転送先を決め、後のルールは確認しません。` : `${rule.pathPattern} に一致しないため、次のルールへ進みます。` });
    if (matched) { targetGroupId = rule.targetGroupId; matchedRuleId = rule.id; break; }
  }
  if (!matchedRuleId) events.push({ phase: 'default', title: 'Default Rule', detail: '一致するルールがないため、最後に既定の転送先を使います。', targetGroupId });
  const target = targetGroups.find(group => group.id === targetGroupId)!;
  events.push({ phase: 'forward', title: `Forward → ${target.name}`, detail: '選ばれた Target Group へ転送します。このモデルでは各グループに正常なアプリが1台あります。', targetGroupId });
  events.push({ phase: 'destination', title: `到達先：${target.application}`, detail: 'パスは変更せず、そのままアプリへ渡します。', targetGroupId });
  return { targetGroupId, matchedRuleId, events };
}
