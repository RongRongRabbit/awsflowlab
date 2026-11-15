import { copyEdgeState, evaluateCloudFront, type Distribution, type EdgeState, type ViewerRequest, type CloudFrontResult } from './cloudfrontEngine';
export type CloudFrontExecution = { request: ViewerRequest; distribution: Distribution; before: EdgeState; result: CloudFrontResult };
export function createCloudFrontExecution(request: ViewerRequest, distribution: Distribution, state: EdgeState): CloudFrontExecution {
  const config: Distribution = { images: { ...distribution.images }, api: { ...distribution.api }, default: { ...distribution.default } };
  const before = copyEdgeState(state);
  const snapshot = { ...request };
  return { request: snapshot, distribution: config, before, result: evaluateCloudFront(snapshot, config, before) };
}
export function advanceCloudFrontStep(step: number, result: CloudFrontResult): number {
  return Math.min(step + 1, result.events.length - 1);
}
