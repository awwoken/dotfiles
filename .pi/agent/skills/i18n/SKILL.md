---
name: i18n
description: >-
  Use when adding or modifying translated user-facing text, translation keys,
  localization logic, ICU messages, locale files, or parameterized copy in
  applications that use i18n. Covers translation coverage, key design,
  interpolation, plurals, and validation.
---

## Translation Coverage

- When adding or changing a translation key, update all supported locale files.
- Do not leave missing keys, fallback-only values, or untranslated placeholders in other languages.
- When translated content changes identity or meaning, update any semantic keys that name the old content so keys remain accurate.

## Interpolation

- Prefer i18n interpolation parameters over string concatenation.
- Do not build translated sentences with partial strings or inline variables.

Prefer:

```ts
t("welcomeUser", { name });
```

Instead of:

```ts
t("welcome") + name;
```

- Keep complete phrases and sentence structure inside translation files so translators can reorder naturally per language.

## Rich Text Formatting

- Prefer i18n tag interpolation or rich-text formatting APIs over concatenating formatted fragments.
- Do not split translated sentences to inject styled JSX, HTML, or highlighted text.

Prefer:

```tsx
t.rich("message", {
  strong: (chunks) => <strong>{chunks}</strong>,
});
```

With translation:

```json
{
  "message": "This is <strong>important</strong>"
}
```

Instead of:

```tsx
t("start") + highlightedText + t("end");
```

- Keep the full formatted sentence inside the translation so translators control word order and formatting placement.

## ICU Formatting

- Use ICU message syntax for interpolated numbers, counts, and formatted values.
- Prefer ICU plural/select formatting over manual conditional logic in code.

Prefer:

```json
{
  "itemCount": "{count, plural, one {# item} other {# items}}"
}
```

Instead of:

```ts
count === 1 ? `${count} item` : `${count} items`;
```

- Use ICU number formatting for localized numeric display when supported by the i18n framework.

Prefer:

```json
{
  "price": "{value, number}"
}
```

## Verification

Validate landed translation paths with `jq` after editing locale files. Do not dump entire translation files into the context.

Example:

```bash
jq -e '.homepage.title' messages/en.json > /dev/null
```

Or for nested dynamic paths:

```bash
jq -e 'getpath(["homepage","title"])' messages/en.json > /dev/null
```

## Implementation Bias

- Match the existing i18n library patterns and translation structure already used in the codebase.
