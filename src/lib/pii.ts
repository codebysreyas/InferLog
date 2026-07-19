type Rule = { name: string; pattern: RegExp; mask: string };

const RULES: Rule[] = [
  {
    name: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    mask: "[email]",
  },
  {
    name: "credit_card",
    pattern: /\b(?:\d[ -]*?){13,16}\b/g,
    mask: "[credit_card]",
  },
  {
    name: "aadhaar",
    pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
    mask: "[aadhaar]",
  },
  {
    name: "pan",
    pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
    mask: "[pan]",
  },
  {
    name: "phone",
    pattern: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3}[-.\s]?\d{3,4}\b/g,
    mask: "[phone]",
  },
];

/**
 * Masks common PII patterns before content is persisted. Order matters:
 * higher-signal patterns (email, credit card, aadhaar, pan) run before the
 * looser phone pattern so they aren't partially consumed by it.
 */
export function redactPII(input: string): string {
  return RULES.reduce((text, rule) => text.replace(rule.pattern, rule.mask), input);
}
