import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
afterEach(() => { cleanup(); vi.useRealTimers(); });
const next = () => fireEvent.click(screen.getByRole('button', { name: '次の章へ' }));
describe('beginner lessons', () => {
  it('navigates all three chapters and presenter keyboard shortcuts', () => {
    render(<App/>); expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('AWS WAF とは？');
    next(); expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('WAF ルールの仕組み'); next(); expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ルールを変えて試してみよう！');
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true }); expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('WAF ルールの仕組み');
    fireEvent.click(screen.getByRole('button', { name: '発表モード' })); expect(document.querySelector('.presenter')).not.toBeNull(); fireEvent.keyDown(window, { key: 'Escape' }); expect(document.querySelector('.presenter')).toBeNull();
  });
  it('keeps initial result hidden and preserves v0.1 toggle behavior', () => {
    render(<App/>); expect(document.querySelectorAll('.diagram > .node')).toHaveLength(3); expect(document.querySelector('.diagram .acl')).toBeNull(); expect(screen.queryByRole('status')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: /攻撃サンプル/ }));
    fireEvent.click(screen.getByRole('button', { name: '次のステップ →' })); for (let i = 0; i < 2; i++) fireEvent.click(screen.getByRole('button', { name: '次のステップ →' }));
    expect(screen.getByRole('status').textContent).toContain('BLOCK'); fireEvent.click(screen.getByRole('checkbox', { name: '攻撃検知ルール' }));
    fireEvent.click(screen.getByRole('button', { name: '次のステップ →' })); for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: '次のステップ →' })); expect(screen.getByRole('status').textContent).toContain('ALLOW'); expect(document.querySelector('.waf small')?.textContent).toBe('DISABLED');
  });
  it('renders only evaluated rules and priority swap changes outcome', () => {
    render(<App/>); next(); next(); fireEvent.click(screen.getByRole('button', { name: /攻撃サンプル/ })); fireEvent.click(screen.getByRole('button', { name: '次のステップ →' }));
    fireEvent.click(screen.getByRole('button', { name: '次のステップ →' })); fireEvent.click(screen.getByRole('button', { name: '次のステップ →' }));
    expect(screen.getByRole('status').textContent).toContain('BLOCK'); expect(screen.getByText('未評価（前のルールで終了）')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ルールの順番を入れ替え' })); fireEvent.click(screen.getByRole('button', { name: '次のステップ →' })); fireEvent.click(screen.getByRole('button', { name: '次のステップ →' })); fireEvent.click(screen.getByRole('button', { name: '次のステップ →' }));
    expect(screen.getByRole('status').textContent).toContain('ALLOW'); expect(screen.getByText(/前の実行：/).textContent).toContain('BLOCK');
  });
  it('Count continues and disabled rules fall back to editable default', () => {
    render(<App/>); next(); next(); fireEvent.click(screen.getByRole('button', { name: /攻撃サンプル/ }));
    fireEvent.change(screen.getByLabelText('攻撃の特徴を確認 Action'), { target: { value: 'COUNT' } }); fireEvent.change(screen.getByLabelText('すべてのサンプルを確認 Action'), { target: { value: 'COUNT' } }); fireEvent.change(screen.getByLabelText('Default Action'), { target: { value: 'BLOCK' } });
    fireEvent.click(screen.getByRole('button', { name: '次のステップ →' })); for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: '次のステップ →' }));
    expect(screen.getByRole('status').textContent).toContain('BLOCK'); expect(screen.getByRole('status').textContent).toContain('Count：2'); expect(screen.getAllByText('COUNT').length).toBe(2);
    fireEvent.click(screen.getByLabelText('攻撃の特徴を確認 Enabled')); fireEvent.click(screen.getByLabelText('すべてのサンプルを確認 Enabled')); fireEvent.click(screen.getByRole('button', { name: '次のステップ →' })); for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: '次のステップ →' })); expect(screen.getByRole('status').textContent).toContain('Count：0');
  });
  it('automatic playback stops at result and configuration cannot alter its snapshot', () => {
    vi.useFakeTimers(); render(<App/>); fireEvent.click(screen.getByRole('button', { name: /攻撃サンプル/ })); fireEvent.click(screen.getByRole('button', { name: '▶ リクエストを送信' }));
    act(() => { vi.advanceTimersByTime(950); }); expect(document.querySelector('.diagram > .waf.activated')).not.toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: '攻撃検知ルール' })); expect(screen.getByText(/設定が変わりました/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '再生' })); for (let i = 0; i < 3; i++) act(() => { vi.advanceTimersByTime(950); }); expect(screen.getByRole('status').textContent).toContain('BLOCK'); expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'リセット' })); expect(screen.queryByRole('status')).toBeNull(); expect(document.querySelector('.flowing')).toBeNull();
  });
});
