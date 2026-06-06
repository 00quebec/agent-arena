import { shellQuote } from "./shell.js";

export type TemplateValues = Record<string, string>;

export function renderCommandTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : shellQuote(value);
  });
}
