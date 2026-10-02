/**
 * Pure keyboard-editing helpers for the Python textarea editor.
 *
 * Every helper takes the current source plus the selection and returns the next
 * source and selection, so the behaviour can be unit-tested without a browser.
 * The page component only applies the returned edit to the textarea.
 */

export const INDENT = "    ";

export type EditorEdit = { value: string; selectionStart: number; selectionEnd: number };

const OPEN_BRACKETS: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const DEDENT_AFTER = /^(return|break|continue|pass|raise)\b/;
const DEDENT_KEYWORDS: Array<{ pattern: RegExp; openers: RegExp }> = [
  { pattern: /^(else|elif\b.*)$/, openers: /^(if|elif|for|while|try|except)\b/ },
  { pattern: /^(except\b.*|finally)$/, openers: /^(try|except)\b/ },
  { pattern: /^case\b.*$/, openers: /^(match|case)\b/ }
];

export function lineStartAt(code: string, position: number): number {
  return code.lastIndexOf("\n", position - 1) + 1;
}

export function lineEndAt(code: string, position: number): number {
  const index = code.indexOf("\n", position);
  return index === -1 ? code.length : index;
}

export function leadingWhitespace(line: string): string {
  return line.match(/^[ \t]*/)?.[0] ?? "";
}

/** Strips a trailing `# comment` (ignoring `#` inside simple string literals) and trailing whitespace. */
export function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "#") return line.slice(0, i).trimEnd();
  }
  return line.trimEnd();
}

function dedentOnce(indent: string): string {
  if (indent.endsWith("\t")) return indent.slice(0, -1);
  const trailingSpaces = indent.length - indent.trimEnd().length;
  return indent.slice(0, indent.length - Math.min(INDENT.length, trailingSpaces));
}

/**
 * Enter: keep the current indentation, add one level after a line that opens a
 * block (`:`) or an open bracket, drop one level after `return`/`break`/etc, and
 * pad the closing bracket onto its own line when the cursor sits between a pair.
 */
export function enterEdit(code: string, start: number, end: number): EditorEdit {
  const lineStart = lineStartAt(code, start);
  const before = code.slice(lineStart, start);
  const lineEnd = lineEndAt(code, end);
  const after = code.slice(end, lineEnd);
  const indent = leadingWhitespace(before);
  const logical = stripComment(before);
  const trimmed = logical.trim();
  const lastChar = logical.slice(-1);

  let nextIndent = indent;
  if (lastChar === ":" || lastChar in OPEN_BRACKETS) nextIndent = indent + INDENT;
  else if (DEDENT_AFTER.test(trimmed)) nextIndent = dedentOnce(indent);

  const afterTrimmed = after.trimStart();
  if (lastChar in OPEN_BRACKETS && afterTrimmed.startsWith(OPEN_BRACKETS[lastChar])) {
    const insert = `\n${nextIndent}\n${indent}`;
    const value = `${code.slice(0, start)}${insert}${afterTrimmed}${code.slice(lineEnd)}`;
    const caret = start + 1 + nextIndent.length;
    return { value, selectionStart: caret, selectionEnd: caret };
  }

  const insert = `\n${nextIndent}`;
  const value = `${code.slice(0, start)}${insert}${code.slice(end)}`;
  const caret = start + insert.length;
  return { value, selectionStart: caret, selectionEnd: caret };
}

/** Tab: indent every selected line, or insert one indent unit at the caret. */
export function tabEdit(code: string, start: number, end: number): EditorEdit {
  const selectedText = code.slice(start, end);
  if (!selectedText.includes("\n")) {
    const value = `${code.slice(0, start)}${INDENT}${code.slice(end)}`;
    const caret = start + INDENT.length;
    return { value, selectionStart: caret, selectionEnd: caret };
  }
  const lineStart = lineStartAt(code, start);
  const block = code.slice(lineStart, end);
  // Indent every non-empty line; blank lines stay blank so no trailing whitespace is introduced.
  const replacement = block.replace(/^(?=[^\n])/gm, INDENT);
  const firstLineIndented = block.length > 0 && block[0] !== "\n";
  const value = `${code.slice(0, lineStart)}${replacement}${code.slice(end)}`;
  return { value, selectionStart: start + (firstLineIndented ? INDENT.length : 0), selectionEnd: end + (replacement.length - block.length) };
}

/** Shift+Tab: remove up to one indent unit from every line touched by the selection. */
export function shiftTabEdit(code: string, start: number, end: number): EditorEdit {
  const lineStart = lineStartAt(code, start);
  const block = code.slice(lineStart, Math.max(end, start));
  const firstLineIndent = leadingWhitespace(block.split("\n")[0]).length;
  const replacement = block.replace(/^( {1,4}|\t)/gm, "");
  const removed = block.length - replacement.length;
  const removedOnFirstLine = Math.min(INDENT.length, firstLineIndent);
  const value = `${code.slice(0, lineStart)}${replacement}${code.slice(Math.max(end, start))}`;
  const nextStart = Math.max(lineStart, start - Math.min(removedOnFirstLine, Math.max(0, start - lineStart)));
  const nextEnd = Math.max(nextStart, end - removed);
  return { value, selectionStart: nextStart, selectionEnd: nextEnd };
}

/**
 * Backspace inside leading whitespace removes a whole indent unit instead of one
 * space. Returns null when the default browser behaviour should run.
 */
export function backspaceEdit(code: string, start: number, end: number): EditorEdit | null {
  if (start !== end || start === 0) return null;
  const lineStart = lineStartAt(code, start);
  const before = code.slice(lineStart, start);
  if (before.length === 0 || before.trim().length > 0) return null;
  const remove = ((before.length - 1) % INDENT.length) + 1;
  const value = `${code.slice(0, start - remove)}${code.slice(start)}`;
  return { value, selectionStart: start - remove, selectionEnd: start - remove };
}

/**
 * Typing `:` after `else`, `elif`, `except`, `finally`, or `case` snaps the line
 * back to the indentation of its matching opener. Returns null when no
 * adjustment is needed so the browser inserts the colon normally.
 */
export function colonEdit(code: string, start: number, end: number): EditorEdit | null {
  if (start !== end) return null;
  const lineStart = lineStartAt(code, start);
  const lineEnd = lineEndAt(code, start);
  if (code.slice(start, lineEnd).trim().length > 0) return null;
  const line = code.slice(lineStart, start);
  const indent = leadingWhitespace(line);
  const keyword = line.trim();
  const rule = DEDENT_KEYWORDS.find((entry) => entry.pattern.test(keyword));
  if (!rule) return null;
  const targetIndent = findOpenerIndent(code, lineStart, indent, rule.openers);
  if (targetIndent === null || targetIndent.length >= indent.length) return null;
  const value = `${code.slice(0, lineStart)}${targetIndent}${keyword}:${code.slice(lineEnd)}`;
  const caret = lineStart + targetIndent.length + keyword.length + 1;
  return { value, selectionStart: caret, selectionEnd: caret };
}

function findOpenerIndent(code: string, lineStart: number, currentIndent: string, openers: RegExp): string | null {
  const previous = code.slice(0, Math.max(0, lineStart - 1)).split("\n");
  for (let i = previous.length - 1; i >= 0; i -= 1) {
    const candidate = stripComment(previous[i]);
    if (candidate.trim().length === 0) continue;
    const candidateIndent = leadingWhitespace(candidate);
    if (candidateIndent.length > currentIndent.length) continue;
    if (openers.test(candidate.trim()) && candidate.trimEnd().endsWith(":")) return candidateIndent;
    if (candidateIndent.length < currentIndent.length && !openers.test(candidate.trim())) {
      // Reached an enclosing statement that is not an opener for this keyword; keep searching upward
      // only while we are still inside a block that could own the keyword.
      currentIndent = candidateIndent;
    }
  }
  return null;
}
