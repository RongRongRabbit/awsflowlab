import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
afterEach(() => { cleanup(); vi.useRealTimers(); });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const openAlb = () => { render(<App/>); click('ALB'); };
const finish = () => { click('次のステップ →'); for (let i = 0; i < 10 && !screen.queryByRole('status'); i++) click('次のステップ →'); };
describe('ALB playground', () => {
  it('keeps WAF as the entry and loads all four ALB scenarios without auto-running', () => {
    openAlb(); expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Application Load Balancer');
    const scenarios = ['01 既定の Web アプリへ', '02 API パスを振り分ける', '03 画像パスを振り分ける', '04 Priority で転送先を変える'];
    const applications = ['Web アプリ', 'API アプリ', '画像アプリ', 'Web アプリ'];
    scenarios.forEach((scenario, index) => {
      click(scenario); expect(screen.queryByRole('status')).toBeNull();
      finish(); expect(screen.getByRole('status').textContent).toContain(applications[index]);
    });
    expect(screen.getAllByText('未評価（前のルールで終了）')).toHaveLength(2);
  });
  it('supports path selection, ON/OFF and default target changes', () => {
    openAlb(); fireEvent.change(screen.getByLabelText('リクエストのパス'), { target: { value: '/api/users' } });
    finish(); expect(screen.getByRole('status').textContent).toContain('API アプリ');
    fireEvent.click(screen.getByLabelText('API パス ON/OFF')); finish(); expect(screen.getByRole('status').textContent).toContain('Web アプリ');
    fireEvent.change(screen.getByLabelText('Default Rule の転送先'), { target: { value: 'images' } });
    finish(); expect(screen.getByRole('status').textContent).toContain('画像アプリ');
    fireEvent.click(screen.getByLabelText('API パス ON/OFF'));
    fireEvent.change(screen.getByLabelText('API パス 転送先'), { target: { value: 'web' } });
    finish(); expect(screen.getByRole('status').textContent).toContain('Web アプリ');
    expect(screen.getByRole('status').textContent).toContain('一致したルール');
    fireEvent.change(screen.getByLabelText('リクエストのパス'), { target: { value: '/API/users' } }); finish();
    expect(screen.getByRole('status').textContent).toContain('Default Rule');
  });
  it('swaps duplicate priorities, rejects invalid values and re-routes overlapping paths', () => {
    openAlb(); click('04 Priority で転送先を変える'); finish(); expect(screen.getByRole('status').textContent).toContain('Web アプリ');
    const priority = screen.getByLabelText('API パス Priority') as HTMLInputElement;
    for (const value of ['0', '50001', '2.5']) { fireEvent.change(priority, { target: { value } }); expect(priority.value).toBe('10'); }
    fireEvent.change(priority, { target: { value: '5' } });
    expect((screen.getByLabelText('全パス Priority') as HTMLInputElement).value).toBe('10');
    finish(); expect(screen.getByRole('status').textContent).toContain('API アプリ');
  });
  it('plays evaluation events, pauses on edit, replays the snapshot and resets settings', () => {
    vi.useFakeTimers(); openAlb(); click('02 API パスを振り分ける'); click('▶ リクエストを送信');
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.querySelector('.alb-target.activated')).toBeNull();
    act(() => { vi.advanceTimersByTime(950); }); expect(document.querySelector('.alb-rule.activated')?.textContent).toContain('MATCH');
    expect(document.querySelector('.alb-target.activated')).toBeNull();
    click('一時停止'); expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByLabelText('API パス ON/OFF')); expect(screen.getByText(/設定が変わりました/)).toBeTruthy();
    click('再生'); for (let i = 0; i < 5; i++) act(() => { vi.advanceTimersByTime(950); });
    expect(screen.getByRole('status').textContent).toContain('API アプリ'); expect(vi.getTimerCount()).toBe(0);
    finish(); expect(screen.getByRole('status').textContent).toContain('Web アプリ');
    click('リセット'); expect(screen.queryByRole('status')).toBeNull(); expect(document.querySelector('.flowing')).toBeNull();
    expect((screen.getByLabelText('リクエストのパス') as HTMLSelectElement).value).toBe('/');
    expect((screen.getByLabelText('API パス ON/OFF') as HTMLInputElement).checked).toBe(true);
  });
  it('uses native knowledge/advanced disclosures and cycles scenarios with the keyboard', () => {
    openAlb(); const advanced = screen.getByText(/Advanced Settings/, { selector: 'summary' }).closest('details')!;
    expect(advanced.open).toBe(false); fireEvent.click(advanced.querySelector('summary')!); expect(advanced.open).toBe(true);
    const card = screen.getByText('Target Group', { selector: 'summary' }).closest('details')!;
    expect(card.open).toBe(false); fireEvent.click(card.querySelector('summary')!); expect(card.open).toBe(true);
    fireEvent.click(card.querySelector('summary')!); expect(card.open).toBe(false);
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true });
    expect(screen.getByRole('button', { name: '04 Priority で転送先を変える' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true });
    expect(screen.getByRole('button', { name: '01 既定の Web アプリへ' }).getAttribute('aria-pressed')).toBe('true');
  });
  it('cleans up playback and keyboard listeners when changing services', () => {
    vi.useFakeTimers(); openAlb(); click('▶ リクエストを送信'); expect(vi.getTimerCount()).toBe(1);
    click('AWS WAF'); expect(vi.getTimerCount()).toBe(0); expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('AWS WAF');
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true }); finish(); expect(screen.getByRole('status').textContent).toContain('BLOCK');
    click('ALB'); expect(screen.queryByRole('status')).toBeNull(); expect((screen.getByLabelText('リクエストのパス') as HTMLSelectElement).value).toBe('/');
  });
});
