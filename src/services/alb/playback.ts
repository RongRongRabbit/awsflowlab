import { evaluateAlb, type AlbResult, type Listener } from './albEngine';
export type AlbExecution = { path: string; listener: Listener; result: AlbResult };
export function createAlbExecution(path: string, listener: Listener): AlbExecution {
  const snapshot = { defaultTargetGroupId: listener.defaultTargetGroupId, rules: listener.rules.map(rule => ({ ...rule })) };
  return { path, listener: snapshot, result: evaluateAlb(path, snapshot) };
}
export function advanceAlbStep(step: number, result: AlbResult): number {
  return Math.min(step + 1, result.events.length - 1);
}
