import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import App, { createScenario } from './App';
import { evaluateWaf } from './services/waf/wafEngine';
afterEach(() => { cleanup(); vi.useRealTimers(); });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const finish = () => { click('次のステップ →'); for (let i = 0; i < 6 && !screen.queryByRole('status'); i++) click('次のステップ →'); };
describe('WAF playground', () => {
  it('loads independent scenarios without executing them', () => {
    render(<App/>);
    const expected = ['ALLOW', 'BLOCK', 'ALLOW', 'ALLOW'];
    for (let index = 0; index < 4; index++) {
      const sample = createScenario(index);
      expect(evaluateWaf(sample.kind, sample.acl).action).toBe(expected[index]);
    }
    click('02 不審なリクエストを Block'); expect(screen.queryByRole('status')).toBeNull();
    finish(); expect(screen.getByRole('status').textContent).toContain('BLOCK');
    expect(screen.getByText('未評価（前のルールで終了）')).toBeTruthy();
    click('04 ルールの順番を変更'); expect(screen.queryByRole('status')).toBeNull(); finish(); expect(screen.getByRole('status').textContent).toContain('ALLOW');
  });
  it('keeps beginner toggle, Count and editable default behavior', () => {
    render(<App/>); click('攻撃サンプル'); finish(); expect(screen.getByRole('status').textContent).toContain('BLOCK');
    fireEvent.click(screen.getByLabelText('攻撃検知ルール')); finish(); expect(screen.getByRole('status').textContent).toContain('ALLOW');
    fireEvent.click(screen.getByLabelText('攻撃検知ルール'));
    fireEvent.change(screen.getByLabelText('攻撃の特徴を確認 Action'), { target: { value: 'COUNT' } });
    fireEvent.change(screen.getByLabelText('すべてのサンプルを確認 Action'), { target: { value: 'COUNT' } });
    fireEvent.change(screen.getByLabelText('Default Action'), { target: { value: 'BLOCK' } });
    finish(); expect(screen.getByRole('status').textContent).toContain('BLOCK'); expect(screen.getByRole('status').textContent).toContain('Count：2');
    expect(screen.getByText('前の結果と比較').closest('details')?.textContent).toContain('ALLOW');
  });
  it('exchanges duplicate priorities and rejects negative or fractional priorities', () => {
    render(<App/>); click('攻撃サンプル');
    const input = screen.getByLabelText('攻撃の特徴を確認 Priority') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-1' } }); expect(input.value).toBe('10');
    fireEvent.change(input, { target: { value: '1.5' } }); expect(input.value).toBe('10');
    fireEvent.change(input, { target: { value: '20' } }); expect((screen.getByLabelText('すべてのサンプルを確認 Priority') as HTMLInputElement).value).toBe('10');
    finish(); expect(screen.getByRole('status').textContent).toContain('ALLOW');
  });
  it('provides collapsed knowledge and advanced controls', () => {
    render(<App/>); expect(document.querySelectorAll('.knowledge-grid details')).toHaveLength(6);
    const card = screen.getByText('Action', { selector: 'summary' }).closest('details')!;
    expect(card.open).toBe(false); fireEvent.click(card.querySelector('summary')!); expect(card.open).toBe(true);
    fireEvent.click(card.querySelector('summary')!); expect(card.open).toBe(false);
    expect(screen.getByText(/Advanced Settings/, { selector: 'summary' }).closest('details')?.open).toBe(false);
  });
  it('uses one playground with keyboard scenario navigation and reset', () => {
    render(<App/>);
    expect(screen.queryByRole('button', { name: 'Hands-on 紹介モード' })).toBeNull();
    expect(screen.queryByRole('button', { name: '発表モード' })).toBeNull();
    expect(screen.getByLabelText('Default Action')).toBeTruthy();
    expect(screen.getByText('気になることから学ぶ')).toBeTruthy();
    expect(document.querySelector('.diagram .acl')).toBeTruthy();
    finish(); expect(screen.getByRole('status').textContent).toContain('ALLOW');
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true }); finish(); expect(screen.getByRole('status').textContent).toContain('BLOCK');
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true }); finish(); expect(screen.getByRole('status').textContent).toContain('Count：1');
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true });
    expect(screen.getByRole('button', { name: '04 ルールの順番を変更' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true });
    expect(screen.getByRole('button', { name: '01 通常のリクエスト' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true });
    expect(screen.getByRole('button', { name: '04 ルールの順番を変更' }).getAttribute('aria-pressed')).toBe('true');
    click('リセット'); expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: '01 通常のリクエスト' }).getAttribute('aria-pressed')).toBe('true');
  });
  it('plays real events, pauses on edits, replays snapshots and resets all settings', () => {
    vi.useFakeTimers(); render(<App/>); click('攻撃サンプル'); click('▶ リクエストを送信');
    act(() => { vi.advanceTimersByTime(950); }); expect(document.querySelector('.rule-node.activated')?.textContent).toContain('MATCH');
    click('一時停止'); expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByLabelText('攻撃検知ルール')); expect(screen.getByText(/設定が変わりました/)).toBeTruthy();
    click('再生'); for (let i = 0; i < 4; i++) act(() => { vi.advanceTimersByTime(950); });
    expect(screen.getByRole('status').textContent).toContain('BLOCK'); expect(vi.getTimerCount()).toBe(0);
    click('リセット'); expect(screen.queryByRole('status')).toBeNull(); expect(document.querySelector('.flowing')).toBeNull(); expect((screen.getByLabelText('攻撃検知ルール') as HTMLInputElement).checked).toBe(true);
  });
});
