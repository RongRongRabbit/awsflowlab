import { advanceTime, createDistribution, createEdgeState, evaluateCloudFront, updateOrigin, type ViewerRequest } from './cloudfrontEngine';
export const cloudFrontScenarios = [
  { title: '初回と2回目のアクセス', hint: '同じリクエストを2回送り、Miss と Hit を比べましょう。' },
  { title: '更新したのに古い内容？', hint: '準備済み：キャッシュは v1、オリジンは v2。送信すると何が返るでしょう？' },
  { title: 'TTL が切れると？', hint: '準備済み：v1 を保存して20秒経過、オリジンは v2。「時間 +10秒」の前後で送り比べましょう。' },
  { title: '言語とキャッシュキー', hint: '準備済み：JA の内容を保存。EN で送信し、設定の「lang をキーに含める」を ON にして再送信しましょう。' },
  { title: '画像と API の違い', hint: 'API を2回送信し、次に画像パスを2回送信。キャッシュする場合としない場合を比べましょう。' },
  { title: '待たずにキャッシュを無効化', hint: '準備済み：キャッシュは v1、オリジンは v2。送信後に Invalidation を実行し、再送信しましょう。' },
];
export function createCloudFrontScenario(index: number) {
  const distribution = createDistribution();
  let state = createEdgeState();
  const request: ViewerRequest = { path: '/index.html', language: 'ja' };
  if ([1, 2, 3, 5].includes(index)) state = evaluateCloudFront(request, distribution, state).nextState;
  if ([1, 2, 5].includes(index)) state = updateOrigin(state, request.path);
  if (index === 2) state = advanceTime(state, 20);
  if (index === 3) request.language = 'en';
  if (index === 4) request.path = '/api/users';
  return { distribution, state, request };
}
