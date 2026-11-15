import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
afterEach(() => { cleanup(); vi.useRealTimers(); });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const open = () => { render(<App/>); click('CloudFront'); };
const run = () => { click('次のステップ →'); for (let i = 0; i < 8; i++) { if (document.querySelector('.current-explanation')) click('次のステップ →'); } };
describe('CloudFront playground', () => {
  it('loads every scenario without starting playback and explains prepared cache state', () => {
    open(); expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Amazon CloudFront');
    const names = ['01 初回と2回目のアクセス', '02 更新したのに古い内容？', '03 TTL が切れると？', '04 言語とキャッシュキー', '05 画像と API の違い', '06 待たずにキャッシュを無効化'];
    names.forEach(name => { click(name); expect(screen.queryByRole('status')).toBeNull(); expect(document.querySelector('.current-explanation')).toBeNull(); });
    expect(screen.getByText(/準備済み：キャッシュは v1/)).toBeTruthy();
  });
  it('misses then hits and keeps old contents until exact expiry after origin update', () => {
    open(); run(); expect(screen.getByRole('status').textContent).toContain('MISS');
    run(); expect(screen.getByRole('status').textContent).toContain('HIT');
    click('このパスのオリジンを更新'); run(); expect(screen.getByRole('status').textContent).toContain('v1');
    for (let i = 0; i < 3; i++) click('時間 +10秒');
    expect(screen.getByText('期限切れ')).toBeTruthy();
    run(); expect(screen.getByRole('status').textContent).toContain('MISS'); expect(screen.getByRole('status').textContent).toContain('v2');
  });
  it('reveals a language collision and separates language keys through the settings', () => {
    open(); click('04 言語とキャッシュキー'); run();
    expect(screen.getByRole('status').textContent).toContain('リクエスト言語：EN / 応答言語：JA');
    const settings = screen.getByText('キャッシュの設定').closest('details')!;
    expect(settings.open).toBe(false); fireEvent.click(settings.querySelector('summary')!); expect(settings.open).toBe(true);
    fireEvent.click(screen.getByLabelText('Default (*) lang をキーに含める')); run();
    expect(screen.getByRole('status').textContent).toContain('MISS'); expect(screen.getByRole('status').textContent).toContain('EN · v1');
    expect(screen.getByRole('rowheader', { name: '/index.html?lang=en' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('クエリ lang'), { target: { value: 'ja' } }); run();
    expect(screen.getByRole('rowheader', { name: '/index.html?lang=ja' })).toBeTruthy();
    fireEvent.click(settings.querySelector('summary')!); expect(settings.open).toBe(false);
  });
  it('bypasses API caching, caches images and allows valid TTL changes', () => {
    open(); click('05 画像と API の違い'); run(); expect(screen.getByRole('status').textContent).toContain('BYPASS');
    expect(screen.getByText('キャッシュは空です。')).toBeTruthy(); run(); expect(screen.getByRole('status').textContent).toContain('BYPASS');
    fireEvent.change(screen.getByLabelText('リクエストのパス'), { target: { value: '/images/logo.png' } }); run(); expect(screen.getByRole('status').textContent).toContain('MISS');
    run(); expect(screen.getByRole('status').textContent).toContain('HIT');
    const ttl = screen.getByLabelText('/images/* TTL') as HTMLInputElement;
    for (const value of ['-1', '0.5', '3601']) { fireEvent.change(ttl, { target: { value } }); expect(ttl.value).toBe('60'); }
    fireEvent.change(ttl, { target: { value: '0' } }); run(); expect(screen.getByRole('status').textContent).toContain('BYPASS');
  });
  it('invalidates cached contents without changing origin and fetches on the next request', () => {
    open(); click('06 待たずにキャッシュを無効化'); run(); expect(screen.getByRole('status').textContent).toContain('HIT');
    click('Invalidation を実行'); expect(screen.getByText(/1 件を無効化/)).toBeTruthy(); expect(screen.getByText('キャッシュは空です。')).toBeTruthy();
    expect(screen.getByText(/選択パスの Origin：v2/)).toBeTruthy();
    run(); expect(screen.getByRole('status').textContent).toContain('MISS'); expect(screen.getByRole('status').textContent).toContain('v2');
    fireEvent.change(screen.getByLabelText('無効化するパス'), { target: { value: '/*' } }); click('Invalidation を実行');
    expect(screen.getByText('キャッシュは空です。')).toBeTruthy();
  });
  it('drives animation from events, pauses on changes and replay never processes a new request', () => {
    vi.useFakeTimers(); open(); click('▶ リクエストを送信');
    expect(document.querySelector('.cf-diagram .flowing')).toBeTruthy(); expect(screen.queryByRole('status')).toBeNull();
    act(() => { vi.advanceTimersByTime(950); }); click('一時停止'); expect(vi.getTimerCount()).toBe(0);
    click('このパスのオリジンを更新'); expect(screen.getByText(/表示中の実行は前の結果/)).toBeTruthy();
    click('再生'); for (let i = 0; i < 7; i++) act(() => { vi.advanceTimersByTime(950); });
    expect(screen.getByRole('status').textContent).toContain('MISS'); expect(screen.getByRole('status').textContent).toContain('v1');
    expect(vi.getTimerCount()).toBe(0); run(); expect(screen.getByRole('status').textContent).toContain('HIT');
    expect(document.querySelector('.cf-diagram .node.disabled')?.textContent).toContain('Origin');
  });
  it('supports knowledge disclosures, scenario keyboard navigation, reset and service cleanup', () => {
    vi.useFakeTimers(); open(); const card = screen.getByText('TTL', { selector: 'summary' }).closest('details')!;
    fireEvent.click(card.querySelector('summary')!); expect(card.open).toBe(true); fireEvent.click(card.querySelector('summary')!); expect(card.open).toBe(false);
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true }); expect(screen.getByRole('button', { name: '06 待たずにキャッシュを無効化' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true }); expect(screen.getByRole('button', { name: '01 初回と2回目のアクセス' }).getAttribute('aria-pressed')).toBe('true');
    click('時間 +10秒'); click('このパスのオリジンを更新'); click('リセット');
    expect(screen.getByText(/時刻：0秒 · 選択パスの Origin：v1/)).toBeTruthy(); expect(screen.getByText('キャッシュは空です。')).toBeTruthy();
    act(() => { vi.runOnlyPendingTimers(); });
    click('▶ リクエストを送信'); expect(vi.getTimerCount()).toBe(1); click('ALB'); expect(vi.getTimerCount()).toBe(0);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Application Load Balancer'); click('AWS WAF'); expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('AWS WAF');
    click('CloudFront'); run(); expect(screen.getByRole('status').textContent).toContain('MISS');
  });
});
