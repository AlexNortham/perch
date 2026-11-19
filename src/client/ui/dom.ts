/** Small DOM helpers shared by the UI modules. */
import { PERCENT, TENTH } from './constants';

export const el = <K extends keyof HTMLElementTagNameMap = 'div'>(
  cls: string,
  tag: K = 'div' as K,
  parent?: HTMLElement,
  content?: string,
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (content !== undefined) e.textContent = content;
  parent?.append(e);
  return e;
};

export const button = (label: string, onClick: () => void, cls = 'pu-btn'): HTMLButtonElement => {
  const b = el(cls, 'button', undefined, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
};

/** A writer that touches the DOM only when the value changes. */
export const cell = <T>(apply: (v: T) => void): ((v: T) => void) => {
  let last: T | undefined;
  return (v) => {
    if (v !== last) {
      last = v;
      apply(v);
    }
  };
};
export const text = (e: HTMLElement): ((v: string) => void) => cell((v) => void (e.textContent = v));
export const flag = (e: HTMLElement, cls: string): ((v: boolean) => void) => cell((v) => e.classList.toggle(cls, v));
export const display = (e: HTMLElement): ((v: boolean) => void) => cell((v) => void (e.style.display = v ? '' : 'none'));
export const attr = (e: HTMLElement, name: string): ((v: string) => void) => cell((v) => e.setAttribute(name, v));

export const pct = (f: number): string => `${Math.round(Math.min(1, Math.max(0, f)) * PERCENT * TENTH) / TENTH}%`;
