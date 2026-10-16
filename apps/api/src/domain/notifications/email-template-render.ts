/**
 * Replaces `{{key}}` placeholders. Unknown keys are left unchanged.
 * Values are inserted as plain text (email body is text/plain).
 */
export function renderEmailTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (full, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] ?? '';
    }
    return full;
  });
}
