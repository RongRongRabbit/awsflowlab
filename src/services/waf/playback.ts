import type { RequestKind, WafResult, WebAcl } from './wafEngine';
import { evaluateWaf } from './wafEngine';
export type Execution = { kind: RequestKind; acl: WebAcl; result: WafResult };
export function createExecution(kind: RequestKind, acl: WebAcl): Execution {
  const snapshot = { defaultAction: acl.defaultAction, rules: acl.rules.map(rule => ({ ...rule })) };
  return { kind, acl: snapshot, result: evaluateWaf(kind, snapshot) };
}
export function advanceStep(step: number, result: WafResult): number {
  return Math.min(step + 1, result.events.length - 1);
}
