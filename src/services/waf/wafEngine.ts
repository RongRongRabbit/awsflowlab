export type RequestKind = 'normal' | 'attack';
export type WafAction = 'ALLOW' | 'BLOCK';
export type WafTrace = { phase: 'request' | 'inspect' | 'decision' | 'destination'; title: string; detail: string };
export type WafResult = { action: WafAction; matched: boolean; trace: WafTrace[] };

/** Teaching-only deterministic model: a single simulated rule + Web ACL default ALLOW. */
export function evaluateWaf(kind: RequestKind, ruleEnabled: boolean): WafResult {
  const matched = kind === 'attack' && ruleEnabled;
  const action: WafAction = matched ? 'BLOCK' : 'ALLOW';
  return {
    action, matched,
    trace: [
      { phase: 'request', title: 'リクエストを送信', detail: kind === 'normal' ? '通常のページ閲覧リクエストを送ります。' : '攻撃の特徴を持つサンプルリクエストを送ります。' },
      { phase: 'inspect', title: 'AWS WAF がルールを確認', detail: ruleEnabled ? (matched ? 'サンプルリクエストが検知ルールに一致しました。' : '検知ルールに一致しませんでした。') : '検知ルールは OFF です。チェックせずに次へ進みます。' },
      { phase: 'decision', title: action === 'ALLOW' ? 'ALLOW：許可' : 'BLOCK：ブロック', detail: matched ? 'ルールに一致したため、WAF がリクエストをブロックします。' : 'ブロックするルールに一致しないため、Web ACL のデフォルト動作 ALLOW が適用されます。' },
      { phase: 'destination', title: matched ? 'Web サイトには届きません' : 'Web サイトへ進みます', detail: matched ? 'WAF がブロック応答を返します。' : 'WAF を通過し、保護対象へ転送されます。' },
    ],
  };
}
