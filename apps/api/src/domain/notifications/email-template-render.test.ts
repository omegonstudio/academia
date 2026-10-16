import { describe, expect, it } from 'vitest';
import { renderEmailTemplate } from './email-template-render.js';

describe('renderEmailTemplate', () => {
  it('replaces known placeholders', () => {
    expect(
      renderEmailTemplate('Hola {{displayName}} — {{meetingUrl}}', {
        displayName: 'Ana',
        meetingUrl: 'https://meet.google.com/x',
      }),
    ).toBe('Hola Ana — https://meet.google.com/x');
  });

  it('leaves unknown placeholders intact', () => {
    expect(renderEmailTemplate('{{missing}} ok', {})).toBe('{{missing}} ok');
  });

  it('allows whitespace inside braces', () => {
    expect(renderEmailTemplate('{{ when }}', { when: 'hoy' })).toBe('hoy');
  });
});
