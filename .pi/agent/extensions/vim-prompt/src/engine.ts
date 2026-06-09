import {
  clamp,
  clampCursor,
  deleteLines,
  deleteRange,
  firstNonBlank,
  inclusiveCharRange,
  insertText,
  lineRange,
  lineLength,
  orderedRange,
  selectedLineText,
  textFromLines,
} from "./buffer.ts";
import {
  moveBufferEnd,
  moveBufferStart,
  moveFirstNonBlank,
  moveLeft,
  moveLineDelta,
  moveLineEnd,
  moveLineStart,
  moveRight,
  moveToLine,
  moveWordBackward,
  moveWordEnd,
  moveWordForward,
} from "./motions.ts";
import {
  rangeIsEmpty,
  resolveDelimitedObject,
  resolveQuoteObject,
  resolveWordObject,
} from "./text-objects.ts";
import type {
  CursorPosition,
  Register,
  TextRange,
  VimPromptMode,
} from "./types.ts";

export type VimKey =
  | string
  | "escape"
  | "enter"
  | "backspace"
  | "ctrl+c"
  | "ctrl+d"
  | "ctrl+g"
  | "ctrl+r";

export type EngineResult = {
  delegate?: boolean;
  changed?: boolean;
  message?: string;
};

type Operator = "delete" | "change" | "yank" | "indent" | "dedent";
type Pending =
  | { type: "operator"; operator: Operator; count: number }
  | { type: "g"; count: number; operator?: Operator }
  | { type: "replace"; count: number }
  | {
      type: "find";
      command: "f" | "F" | "t" | "T";
      count: number;
      operator?: Operator;
    }
  | { type: "textObject"; operator: Operator; count: number; around?: boolean };

type Snapshot = { lines: string[]; cursor: CursorPosition };
type CharFind = { command: "f" | "F" | "t" | "T"; char: string; count: number };
type MotionResult =
  | { kind: "char"; range: TextRange; cursor: CursorPosition }
  | {
      kind: "line";
      startLine: number;
      endLine: number;
      cursor: CursorPosition;
    };

type ChangeRecord = { keys: string[] } | undefined;

const EMPTY_REGISTER: Register = { text: "", linewise: false };

function isDigit(key: string): boolean {
  return /^[0-9]$/.test(key);
}

function isPrintable(key: string): boolean {
  return key.length === 1 && key.charCodeAt(0) >= 32;
}

function operatorForKey(key: string): Operator | undefined {
  if (key === "d") return "delete";
  if (key === "c") return "change";
  if (key === "y") return "yank";
  if (key === ">") return "indent";
  if (key === "<") return "dedent";
  return undefined;
}

function normalizeLines(lines: string[]): string[] {
  return lines.length > 0 ? [...lines] : [""];
}

function cloneSnapshot(snapshot: Snapshot): Snapshot {
  return {
    lines: normalizeLines(snapshot.lines),
    cursor: { ...snapshot.cursor },
  };
}

function linewiseRegister(
  lines: string[],
  startLine: number,
  endLine: number,
): Register {
  return { text: selectedLineText(lines, startLine, endLine), linewise: true };
}

function normalizeLinewiseText(text: string): string[] {
  const trimmed = text.endsWith("\n") ? text.slice(0, -1) : text;
  return trimmed.length > 0 ? trimmed.split("\n") : [""];
}

function indentLines(
  lines: string[],
  startLine: number,
  endLine: number,
  depth: number,
): string[] {
  const next = [...lines];
  for (let line = startLine; line <= endLine; line++)
    next[line] = "  ".repeat(depth) + (next[line] ?? "");
  return next;
}

function dedentLine(text: string, depth: number): string {
  let next = text;
  for (let index = 0; index < depth; index++) {
    if (next.startsWith("  ")) next = next.slice(2);
    else if (next.startsWith("\t") || next.startsWith(" "))
      next = next.slice(1);
  }
  return next;
}

function dedentLines(
  lines: string[],
  startLine: number,
  endLine: number,
  depth: number,
): string[] {
  const next = [...lines];
  for (let line = startLine; line <= endLine; line++)
    next[line] = dedentLine(next[line] ?? "", depth);
  return next;
}

export class PromptVimEngine {
  mode: VimPromptMode = "insert";
  lines: string[] = [""];
  cursor: CursorPosition = { line: 0, col: 0 };
  visualAnchor: CursorPosition | undefined;
  register: Register = EMPTY_REGISTER;
  countBuffer = "";
  message = "";
  searchQuery = "";
  searchInput: string | undefined;
  lastSearch: string | undefined;
  lastCharFind: CharFind | undefined;
  lastChange: ChangeRecord;
  private pending: Pending | undefined;
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private replaying = false;

  sync(lines: string[], cursor: CursorPosition): void {
    this.lines = normalizeLines(lines);
    this.cursor = clampCursor(this.lines, cursor);
  }

  snapshot(): Snapshot {
    return cloneSnapshot({ lines: this.lines, cursor: this.cursor });
  }

  visualSelection():
    | { kind: "char"; start: CursorPosition; end: CursorPosition }
    | { kind: "line"; startLine: number; endLine: number }
    | undefined {
    if (this.mode === "visualLine") {
      const { startLine, endLine } = this.selectedVisualLines();
      return { kind: "line", startLine, endLine };
    }
    if (this.mode === "visual") {
      const range = this.selectedVisualRange();
      return { kind: "char", start: range.start, end: range.end };
    }
    return undefined;
  }

  statusParts(): string[] {
    const parts = [this.modeLabel()];
    if (this.searchInput !== undefined) parts.push(`/${this.searchInput}`);
    else if (this.pending?.type === "operator")
      parts.push(
        `${this.countBuffer}${this.operatorKey(this.pending.operator)}`,
      );
    else if (this.pending?.type === "g") parts.push(`${this.countBuffer}g`);
    else if (this.pending?.type === "replace")
      parts.push(`${this.pending.count}r`);
    else if (this.pending?.type === "find")
      parts.push(`${this.pending.count}${this.pending.command}`);
    else if (this.pending?.type === "textObject")
      parts.push(
        `${this.operatorKey(this.pending.operator)}${this.pending.around ? "a" : "i"}`,
      );
    else if (this.countBuffer) parts.push(this.countBuffer);

    if (this.mode === "visualLine") {
      const { startLine, endLine } = this.selectedVisualLines();
      parts.push(`${startLine + 1}-${endLine + 1}`);
    } else if (this.mode === "visual") {
      parts.push("sel");
    }
    if (this.message) parts.push(this.message);
    return parts;
  }

  handleInsertEscape(lines: string[], cursor: CursorPosition): EngineResult {
    this.sync(lines, cursor);
    this.mode = "normal";
    this.clearTransient();
    return { changed: true };
  }

  handleKey(key: VimKey): EngineResult {
    this.message = "";
    if (this.searchInput !== undefined) return this.handleSearchInput(key);

    if (key === "escape") {
      if (this.mode === "normal") return { delegate: true };
      this.mode = "normal";
      this.visualAnchor = undefined;
      this.clearTransient();
      return { changed: true };
    }

    if (["enter", "ctrl+c", "ctrl+d", "ctrl+g"].includes(key)) {
      this.mode = this.mode === "insert" ? "insert" : "normal";
      this.visualAnchor = undefined;
      this.clearTransient();
      return { delegate: true };
    }

    if (this.mode === "insert") return { delegate: true };
    if (this.pending) return this.handlePending(key);
    if (this.mode === "visual" || this.mode === "visualLine")
      return this.handleVisualKey(key);
    return this.handleNormalKey(key);
  }

  private modeLabel(): string {
    if (this.mode === "insert") return "INSERT";
    if (this.mode === "normal") return "NORMAL";
    if (this.mode === "visual") return "VISUAL";
    return "V-LINE";
  }

  private operatorKey(operator: Operator): string {
    if (operator === "delete") return "d";
    if (operator === "change") return "c";
    if (operator === "yank") return "y";
    if (operator === "indent") return ">";
    return "<";
  }

  private count(defaultValue = 1): number {
    const parsed = this.countBuffer
      ? Number.parseInt(this.countBuffer, 10)
      : defaultValue;
    return clamp(Number.isFinite(parsed) ? parsed : defaultValue, 1, 9999);
  }

  private consumeCount(defaultValue = 1): number {
    const count = this.count(defaultValue);
    this.countBuffer = "";
    return count;
  }

  private clearTransient(): void {
    this.countBuffer = "";
    this.pending = undefined;
  }

  private pushUndo(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = [];
  }

  private setDocument(lines: string[], cursor: CursorPosition): void {
    this.lines = normalizeLines(lines);
    this.cursor = clampCursor(this.lines, cursor);
  }

  private edit(
    lines: string[],
    cursor: CursorPosition,
    keys?: string[],
  ): EngineResult {
    this.pushUndo();
    this.setDocument(lines, cursor);
    if (!this.replaying && keys) this.lastChange = { keys };
    return { changed: true };
  }

  private undo(): EngineResult {
    const previous = this.undoStack.pop();
    if (!previous) return { changed: true };
    this.redoStack.push(this.snapshot());
    this.setDocument(previous.lines, previous.cursor);
    this.mode = "normal";
    this.clearTransient();
    return { changed: true };
  }

  private redo(): EngineResult {
    const next = this.redoStack.pop();
    if (!next) return { changed: true };
    this.undoStack.push(this.snapshot());
    this.setDocument(next.lines, next.cursor);
    this.mode = "normal";
    this.clearTransient();
    return { changed: true };
  }

  private handleNormalKey(key: VimKey): EngineResult {
    if (typeof key !== "string") return { changed: true };
    if (isDigit(key) && (key !== "0" || this.countBuffer.length > 0)) {
      this.countBuffer = `${this.countBuffer}${key}`
        .replace(/^0+/, "")
        .slice(0, 4);
      return { changed: true };
    }

    const operator = operatorForKey(key);
    if (operator) {
      const count = this.consumeCount(1);
      this.pending = { type: "operator", operator, count };
      return { changed: true };
    }

    const hadCount = this.countBuffer.length > 0;
    const count = this.consumeCount(1);
    return this.applyNormalCommand(key, count, [key], hadCount);
  }

  private applyNormalCommand(
    key: string,
    count: number,
    keys: string[],
    hadCount = false,
  ): EngineResult {
    switch (key) {
      case "h":
        return this.move(moveLeft(this.lines, this.cursor, count));
      case "l":
        return this.move(moveRight(this.lines, this.cursor, count));
      case "j":
        return this.move(moveLineDelta(this.lines, this.cursor, count));
      case "k":
        return this.move(moveLineDelta(this.lines, this.cursor, -count));
      case "0":
        return this.move(moveLineStart(this.cursor));
      case "^":
        return this.move(moveFirstNonBlank(this.lines, this.cursor));
      case "_":
        return this.move({
          line: clamp(this.cursor.line + count - 1, 0, this.lines.length - 1),
          col: firstNonBlank(
            this.lines[
              clamp(this.cursor.line + count - 1, 0, this.lines.length - 1)
            ] ?? "",
          ),
        });
      case "$":
        return this.move(moveLineEnd(this.lines, this.cursor));
      case "w":
        return this.move(moveWordForward(this.lines, this.cursor, count));
      case "b":
        return this.move(moveWordBackward(this.lines, this.cursor, count));
      case "e":
        return this.move(moveWordEnd(this.lines, this.cursor, count));
      case "g":
        this.pending = { type: "g", count };
        return { changed: true };
      case "G":
        return this.move(
          hadCount ? moveToLine(this.lines, count) : moveBufferEnd(this.lines),
        );
      case "i":
        this.mode = "insert";
        return { changed: true };
      case "a":
        this.cursor = moveRight(this.lines, this.cursor, 1);
        this.mode = "insert";
        return { changed: true };
      case "I":
        this.cursor = {
          line: this.cursor.line,
          col: firstNonBlank(this.lines[this.cursor.line] ?? ""),
        };
        this.mode = "insert";
        return { changed: true };
      case "A":
        this.cursor = moveLineEnd(this.lines, this.cursor);
        this.mode = "insert";
        return { changed: true };
      case "o":
        return this.openLine(this.cursor.line + 1, keys);
      case "O":
        return this.openLine(this.cursor.line, keys);
      case "v":
        this.visualAnchor = this.cursor;
        this.mode = "visual";
        return { changed: true };
      case "V":
        this.visualAnchor = this.cursor;
        this.mode = "visualLine";
        return { changed: true };
      case "x":
        return this.deleteChars(count, keys);
      case "s": {
        const result = this.deleteChars(count, keys);
        this.mode = "insert";
        return result;
      }
      case "S":
        return this.applyLineOperator("change", count, this.cursor.line, keys);
      case "D":
        return this.deleteToLineEnd(false, keys);
      case "C":
        return this.deleteToLineEnd(true, keys);
      case "Y":
        return this.applyLineOperator("yank", count, this.cursor.line, keys);
      case "p":
        return this.paste(false, count, keys);
      case "P":
        return this.paste(true, count, keys);
      case "r":
        this.pending = { type: "replace", count };
        return { changed: true };
      case "u":
        return this.undo();
      case "ctrl+r":
        return this.redo();
      case ".":
        return this.repeatLastChange();
      case "/":
        this.searchInput = "";
        return { changed: true };
      case "n":
        return this.repeatSearch(false);
      case "N":
        return this.repeatSearch(true);
      case "f":
      case "F":
      case "t":
      case "T":
        this.pending = { type: "find", command: key, count };
        return { changed: true };
      case ";":
        return this.repeatCharFind(false);
      case ",":
        return this.repeatCharFind(true);
      case "J":
        return this.joinLines(count, keys);
    }
    return { changed: true };
  }

  private handlePending(key: VimKey): EngineResult {
    const pending = this.pending;
    if (!pending || typeof key !== "string") {
      this.clearTransient();
      return { changed: true };
    }

    if (
      (pending.type === "operator" || pending.type === "textObject") &&
      isDigit(key) &&
      (key !== "0" || this.countBuffer.length > 0)
    ) {
      this.countBuffer = `${this.countBuffer}${key}`
        .replace(/^0+/, "")
        .slice(0, 4);
      return { changed: true };
    }

    this.pending = undefined;

    if (pending.type === "g") {
      if (key === "g") {
        const target =
          pending.count > 1
            ? moveToLine(this.lines, pending.count)
            : moveBufferStart();
        if (pending.operator) {
          const { startLine, endLine } = lineRange(
            this.cursor.line,
            target.line,
          );
          return this.applyOperatorMotion(
            pending.operator,
            { kind: "line", startLine, endLine, cursor: target },
            [`${this.operatorKey(pending.operator)}g`, "g"],
          );
        }
        return this.move(target);
      }
      return { changed: true };
    }
    if (pending.type === "replace")
      return this.replaceChars(key, pending.count, ["r", key]);
    if (pending.type === "find") {
      const count = pending.count * this.consumeCount(1);
      return this.applyFind(pending.command, key, count, pending.operator);
    }
    if (pending.type === "textObject") {
      const count = pending.count * this.consumeCount(1);
      return this.applyTextObject(
        pending.operator,
        pending.around === true,
        key,
        count,
      );
    }

    const motionCount = this.consumeCount(1);
    const effectiveCount = pending.count * motionCount;
    if (operatorForKey(key) === pending.operator) {
      return this.applyLineOperator(
        pending.operator,
        effectiveCount,
        this.cursor.line,
        [this.operatorKey(pending.operator), key],
      );
    }
    if (key === "i" || key === "a") {
      this.pending = {
        type: "textObject",
        operator: pending.operator,
        count: effectiveCount,
        around: key === "a",
      };
      return { changed: true };
    }
    if (key === "f" || key === "F" || key === "t" || key === "T") {
      this.pending = {
        type: "find",
        command: key,
        count: effectiveCount,
        operator: pending.operator,
      };
      return { changed: true };
    }
    const motion = this.resolveMotion(
      key,
      effectiveCount,
      pending.operator,
      motionCount > 1 || pending.count > 1,
    );
    return motion
      ? this.applyOperatorMotion(pending.operator, motion, [
          this.operatorKey(pending.operator),
          key,
        ])
      : { changed: true };
  }

  private handleVisualKey(key: VimKey): EngineResult {
    if (typeof key !== "string") return { changed: true };
    if (isDigit(key) && (key !== "0" || this.countBuffer.length > 0)) {
      this.countBuffer = `${this.countBuffer}${key}`
        .replace(/^0+/, "")
        .slice(0, 4);
      return { changed: true };
    }
    const count = this.consumeCount(1);
    switch (key) {
      case "h":
        return this.move(moveLeft(this.lines, this.cursor, count));
      case "l":
        return this.move(moveRight(this.lines, this.cursor, count));
      case "j":
        return this.move(moveLineDelta(this.lines, this.cursor, count));
      case "k":
        return this.move(moveLineDelta(this.lines, this.cursor, -count));
      case "0":
        return this.move(moveLineStart(this.cursor));
      case "^":
        return this.move(moveFirstNonBlank(this.lines, this.cursor));
      case "$":
        return this.move(moveLineEnd(this.lines, this.cursor));
      case "w":
        return this.move(moveWordForward(this.lines, this.cursor, count));
      case "b":
        return this.move(moveWordBackward(this.lines, this.cursor, count));
      case "e":
        return this.move(moveWordEnd(this.lines, this.cursor, count));
      case "v":
        this.mode = this.mode === "visual" ? "normal" : "visual";
        if (this.mode === "normal") this.visualAnchor = undefined;
        return { changed: true };
      case "V":
        this.mode = this.mode === "visualLine" ? "normal" : "visualLine";
        if (this.mode === "normal") this.visualAnchor = undefined;
        return { changed: true };
      case "y":
        return this.yankVisual();
      case "d":
      case "x":
        return this.deleteVisual(false, [key]);
      case "c":
      case "s":
      case "S":
        return this.deleteVisual(true, [key]);
      case "p":
      case "P":
        return this.replaceVisualWithRegister([key]);
      case "I":
        return this.visualLineInsertAtStart();
      case "A":
        return this.visualLineInsertAtEnd();
      case ">":
        return this.shiftVisual("indent", count, [key]);
      case "<":
        return this.shiftVisual("dedent", count, [key]);
      case "~":
        return this.toggleVisualCase([key]);
    }
    return { changed: true };
  }

  private handleSearchInput(key: VimKey): EngineResult {
    if (key === "escape" || key === "ctrl+c") {
      this.searchInput = undefined;
      return { changed: true };
    }
    if (key === "backspace") {
      this.searchInput = this.searchInput?.slice(0, -1) ?? "";
      return { changed: true };
    }
    if (key === "enter") {
      const query = this.searchInput ?? "";
      this.searchInput = undefined;
      if (!query) return { changed: true };
      this.lastSearch = query;
      return this.search(query, false);
    }
    if (typeof key === "string" && isPrintable(key)) {
      this.searchInput = `${this.searchInput ?? ""}${key}`;
      return { changed: true };
    }
    return { changed: true };
  }

  private move(cursor: CursorPosition): EngineResult {
    this.cursor = clampCursor(this.lines, cursor);
    return { changed: true };
  }

  private resolveMotion(
    key: string,
    count: number,
    operator?: Operator,
    hadCount = false,
  ): MotionResult | undefined {
    if (key === "g") {
      this.pending = { type: "g", count, operator };
      return undefined;
    }
    if (key === "j" || key === "k") {
      const target = moveLineDelta(
        this.lines,
        this.cursor,
        key === "j" ? count : -count,
      );
      const { startLine, endLine } = lineRange(this.cursor.line, target.line);
      return {
        kind: "line",
        startLine,
        endLine,
        cursor: { line: startLine, col: 0 },
      };
    }
    if (key === "G") {
      const target = hadCount
        ? moveToLine(this.lines, count)
        : moveBufferEnd(this.lines);
      const { startLine, endLine } = lineRange(this.cursor.line, target.line);
      return {
        kind: "line",
        startLine,
        endLine,
        cursor: { line: startLine, col: 0 },
      };
    }
    const target = this.motionTarget(key, count);
    if (!target) return undefined;
    const range =
      key === "e" || key === "l" || key === "$"
        ? inclusiveCharRange(this.lines, this.cursor, target)
        : { start: this.cursor, end: target };
    return { kind: "char", range, cursor: target };
  }

  private motionTarget(key: string, count: number): CursorPosition | undefined {
    switch (key) {
      case "h":
        return moveLeft(this.lines, this.cursor, count);
      case "l":
        return moveRight(this.lines, this.cursor, count);
      case "0":
        return moveLineStart(this.cursor);
      case "^":
        return moveFirstNonBlank(this.lines, this.cursor);
      case "$":
        return moveLineEnd(this.lines, this.cursor);
      case "w":
        return moveWordForward(this.lines, this.cursor, count);
      case "b":
        return moveWordBackward(this.lines, this.cursor, count);
      case "e":
        return moveWordEnd(this.lines, this.cursor, count);
    }
    return undefined;
  }

  private applyOperatorMotion(
    operator: Operator,
    motion: MotionResult,
    keys?: string[],
  ): EngineResult {
    if (motion.kind === "line")
      return this.applyLineOperator(
        operator,
        motion.endLine - motion.startLine + 1,
        motion.startLine,
        keys,
      );
    const range = orderedRange(motion.range.start, motion.range.end);
    if (rangeIsEmpty(range)) return { changed: true };
    if (operator === "indent" || operator === "dedent")
      return { changed: true };
    const result = deleteRange(this.lines, range);
    if (operator === "yank") {
      this.register = { text: result.deleted, linewise: false };
      this.cursor = motion.cursor;
      this.mode = "normal";
      return { changed: true };
    }
    this.register = { text: result.deleted, linewise: false };
    const edit = this.edit(result.lines, result.cursor, keys);
    this.mode = operator === "change" ? "insert" : "normal";
    return edit;
  }

  private applyLineOperator(
    operator: Operator,
    count: number,
    startLine: number,
    keys?: string[],
  ): EngineResult {
    const endLine = clamp(startLine + count - 1, 0, this.lines.length - 1);
    if (operator === "yank") {
      this.register = linewiseRegister(this.lines, startLine, endLine);
      this.message = `${endLine - startLine + 1} line(s) yanked`;
      this.mode = "normal";
      return { changed: true };
    }
    if (operator === "indent" || operator === "dedent") {
      const next =
        operator === "indent"
          ? indentLines(this.lines, startLine, endLine, count)
          : dedentLines(this.lines, startLine, endLine, count);
      return this.edit(
        next,
        { line: startLine, col: firstNonBlank(next[startLine] ?? "") },
        keys,
      );
    }
    this.register = linewiseRegister(this.lines, startLine, endLine);
    const result = deleteLines(
      this.lines,
      startLine,
      endLine,
      operator === "change" ? [""] : [],
    );
    const edit = this.edit(result.lines, result.cursor, keys);
    this.mode = operator === "change" ? "insert" : "normal";
    return edit;
  }

  private applyTextObject(
    operator: Operator,
    around: boolean,
    key: string,
    count: number,
  ): EngineResult {
    let range: TextRange | undefined;
    if (key === "w" || key === "W")
      range = resolveWordObject(
        this.lines,
        this.cursor,
        around,
        key === "W" ? "WORD" : "word",
        count,
      );
    else if (["'", '"', "`"].includes(key))
      range = resolveQuoteObject(this.lines, this.cursor, key, around);
    else range = resolveDelimitedObject(this.lines, this.cursor, key, around);
    if (!range) return { changed: true };
    return this.applyOperatorMotion(
      operator,
      { kind: "char", range, cursor: range.start },
      [this.operatorKey(operator), around ? "a" : "i", key],
    );
  }

  private deleteChars(count: number, keys?: string[]): EngineResult {
    const line = this.lines[this.cursor.line] ?? "";
    if (this.cursor.col >= line.length) return { changed: true };
    const end = {
      line: this.cursor.line,
      col: clamp(this.cursor.col + count, this.cursor.col, line.length),
    };
    const result = deleteRange(this.lines, { start: this.cursor, end });
    this.register = { text: result.deleted, linewise: false };
    return this.edit(result.lines, result.cursor, keys);
  }

  private deleteToLineEnd(enterInsert: boolean, keys?: string[]): EngineResult {
    const result = deleteRange(this.lines, {
      start: this.cursor,
      end: moveLineEnd(this.lines, this.cursor),
    });
    this.register = { text: result.deleted, linewise: false };
    const edit = this.edit(result.lines, result.cursor, keys);
    this.mode = enterInsert ? "insert" : "normal";
    return edit;
  }

  private openLine(index: number, keys?: string[]): EngineResult {
    const next = [...this.lines];
    next.splice(clamp(index, 0, next.length), 0, "");
    const edit = this.edit(
      next,
      { line: clamp(index, 0, next.length - 1), col: 0 },
      keys,
    );
    this.mode = "insert";
    return edit;
  }

  private replaceChars(
    key: string,
    count: number,
    keys?: string[],
  ): EngineResult {
    if (!isPrintable(key)) return { changed: true };
    const line = this.lines[this.cursor.line] ?? "";
    if (this.cursor.col >= line.length) return { changed: true };
    const end = clamp(this.cursor.col + count, this.cursor.col, line.length);
    const next = [...this.lines];
    next[this.cursor.line] =
      line.slice(0, this.cursor.col) +
      key.repeat(end - this.cursor.col) +
      line.slice(end);
    return this.edit(next, this.cursor, keys);
  }

  private paste(before: boolean, count: number, keys?: string[]): EngineResult {
    if (!this.register.text) return { changed: true };
    if (this.register.linewise) {
      const pasteLines = normalizeLinewiseText(this.register.text);
      const repeated = Array.from({ length: count }, () => pasteLines).flat();
      const next = [...this.lines];
      const index = before ? this.cursor.line : this.cursor.line + 1;
      next.splice(clamp(index, 0, next.length), 0, ...repeated);
      return this.edit(
        next,
        { line: clamp(index, 0, next.length - 1), col: 0 },
        keys,
      );
    }
    let nextLines = this.lines;
    let nextCursor = before
      ? this.cursor
      : moveRight(this.lines, this.cursor, 1);
    for (let index = 0; index < count; index++) {
      const inserted = insertText(nextLines, nextCursor, this.register.text);
      nextLines = inserted.lines;
      nextCursor = inserted.cursor;
    }
    return this.edit(nextLines, nextCursor, keys);
  }

  private selectedVisualLines(): { startLine: number; endLine: number } {
    return lineRange((this.visualAnchor ?? this.cursor).line, this.cursor.line);
  }

  private selectedVisualRange(): TextRange {
    return inclusiveCharRange(
      this.lines,
      this.visualAnchor ?? this.cursor,
      this.cursor,
    );
  }

  private yankVisual(): EngineResult {
    if (this.mode === "visualLine") {
      const { startLine, endLine } = this.selectedVisualLines();
      this.register = linewiseRegister(this.lines, startLine, endLine);
    } else {
      const result = deleteRange(this.lines, this.selectedVisualRange());
      this.register = { text: result.deleted, linewise: false };
    }
    this.mode = "normal";
    this.visualAnchor = undefined;
    return { changed: true };
  }

  private deleteVisual(enterInsert: boolean, keys?: string[]): EngineResult {
    if (this.mode === "visualLine") {
      const { startLine, endLine } = this.selectedVisualLines();
      this.register = linewiseRegister(this.lines, startLine, endLine);
      const result = deleteLines(
        this.lines,
        startLine,
        endLine,
        enterInsert ? [""] : [],
      );
      const edit = this.edit(result.lines, result.cursor, keys);
      this.mode = enterInsert ? "insert" : "normal";
      this.visualAnchor = undefined;
      return edit;
    }
    const result = deleteRange(this.lines, this.selectedVisualRange());
    this.register = { text: result.deleted, linewise: false };
    const edit = this.edit(result.lines, result.cursor, keys);
    this.mode = enterInsert ? "insert" : "normal";
    this.visualAnchor = undefined;
    return edit;
  }

  private replaceVisualWithRegister(keys?: string[]): EngineResult {
    if (!this.register.text) return { changed: true };
    if (this.mode === "visualLine") {
      const { startLine, endLine } = this.selectedVisualLines();
      const replacement = this.register.linewise
        ? normalizeLinewiseText(this.register.text)
        : [this.register.text];
      const result = deleteLines(this.lines, startLine, endLine, replacement);
      const edit = this.edit(result.lines, result.cursor, keys);
      this.mode = "normal";
      this.visualAnchor = undefined;
      return edit;
    }
    const deleted = deleteRange(this.lines, this.selectedVisualRange());
    const inserted = insertText(
      deleted.lines,
      deleted.cursor,
      this.register.text,
    );
    const edit = this.edit(inserted.lines, inserted.cursor, keys);
    this.mode = "normal";
    this.visualAnchor = undefined;
    return edit;
  }

  private visualLineInsertAtStart(): EngineResult {
    if (this.mode !== "visualLine") return { changed: true };
    const { startLine } = this.selectedVisualLines();
    this.cursor = {
      line: startLine,
      col: firstNonBlank(this.lines[startLine] ?? ""),
    };
    this.mode = "insert";
    this.visualAnchor = undefined;
    return { changed: true };
  }

  private visualLineInsertAtEnd(): EngineResult {
    if (this.mode !== "visualLine") return { changed: true };
    const { endLine } = this.selectedVisualLines();
    this.cursor = { line: endLine, col: lineLength(this.lines, endLine) };
    this.mode = "insert";
    this.visualAnchor = undefined;
    return { changed: true };
  }

  private shiftVisual(
    operator: "indent" | "dedent",
    depth: number,
    keys?: string[],
  ): EngineResult {
    const { startLine, endLine } = this.selectedVisualLines();
    const next =
      operator === "indent"
        ? indentLines(this.lines, startLine, endLine, depth)
        : dedentLines(this.lines, startLine, endLine, depth);
    const edit = this.edit(
      next,
      { line: startLine, col: firstNonBlank(next[startLine] ?? "") },
      keys,
    );
    this.mode = "normal";
    this.visualAnchor = undefined;
    return edit;
  }

  private toggleVisualCase(keys?: string[]): EngineResult {
    const range =
      this.mode === "visualLine"
        ? {
            start: { line: this.selectedVisualLines().startLine, col: 0 },
            end: {
              line: this.selectedVisualLines().endLine,
              col: lineLength(this.lines, this.selectedVisualLines().endLine),
            },
          }
        : this.selectedVisualRange();
    const result = deleteRange(this.lines, range);
    const toggled = result.deleted.replace(/[A-Za-z]/g, (char) =>
      char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase(),
    );
    const inserted = insertText(result.lines, result.cursor, toggled);
    const edit = this.edit(inserted.lines, result.cursor, keys);
    this.mode = "normal";
    this.visualAnchor = undefined;
    return edit;
  }

  private applyFind(
    command: "f" | "F" | "t" | "T",
    char: string,
    count: number,
    operator?: Operator,
  ): EngineResult {
    if (!isPrintable(char)) return { changed: true };
    const target = this.findChar(command, char, count);
    this.lastCharFind = { command, char, count };
    if (!target) return { changed: true };
    if (operator)
      return this.applyOperatorMotion(
        operator,
        {
          kind: "char",
          range: inclusiveCharRange(this.lines, this.cursor, target),
          cursor: target,
        },
        [this.operatorKey(operator), command, char],
      );
    this.cursor = target;
    return { changed: true };
  }

  private findChar(
    command: "f" | "F" | "t" | "T",
    char: string,
    count: number,
  ): CursorPosition | undefined {
    const line = this.lines[this.cursor.line] ?? "";
    const forward = command === "f" || command === "t";
    let seen = 0;
    if (forward) {
      for (let col = this.cursor.col + 1; col < line.length; col++) {
        if (line[col] === char && ++seen === count)
          return {
            line: this.cursor.line,
            col: command === "t" ? Math.max(this.cursor.col, col - 1) : col,
          };
      }
    } else {
      for (let col = this.cursor.col - 1; col >= 0; col--) {
        if (line[col] === char && ++seen === count)
          return {
            line: this.cursor.line,
            col: command === "T" ? Math.min(line.length, col + 1) : col,
          };
      }
    }
    return undefined;
  }

  private repeatCharFind(reverse: boolean): EngineResult {
    if (!this.lastCharFind) return { changed: true };
    let command = this.lastCharFind.command;
    if (reverse)
      command = ({ f: "F", F: "f", t: "T", T: "t" } as const)[command];
    const target = this.findChar(
      command,
      this.lastCharFind.char,
      this.lastCharFind.count,
    );
    if (target) this.cursor = target;
    return { changed: true };
  }

  private search(query: string, reverse: boolean): EngineResult {
    const text = textFromLines(this.lines);
    const currentOffset = this.offsetFromCursor(this.cursor);
    const index = reverse
      ? text.lastIndexOf(query, Math.max(0, currentOffset - 1))
      : text.indexOf(query, currentOffset + 1);
    const wrapped =
      index === -1
        ? reverse
          ? text.lastIndexOf(query)
          : text.indexOf(query)
        : index;
    if (wrapped >= 0) this.cursor = this.cursorFromOffset(wrapped);
    return { changed: true };
  }

  private repeatSearch(reverse: boolean): EngineResult {
    return this.lastSearch
      ? this.search(this.lastSearch, reverse)
      : { changed: true };
  }

  private offsetFromCursor(cursor: CursorPosition): number {
    let offset = 0;
    for (let line = 0; line < cursor.line; line++)
      offset += (this.lines[line]?.length ?? 0) + 1;
    return offset + cursor.col;
  }

  private cursorFromOffset(offset: number): CursorPosition {
    const text = textFromLines(this.lines).slice(0, offset);
    const parts = text.split("\n");
    return {
      line: parts.length - 1,
      col: parts[parts.length - 1]?.length ?? 0,
    };
  }

  private joinLines(count: number, keys?: string[]): EngineResult {
    if (this.cursor.line >= this.lines.length - 1) return { changed: true };
    const next = [...this.lines];
    let line = this.cursor.line;
    for (let index = 0; index < count && line < next.length - 1; index++) {
      const joined =
        `${next[line]?.replace(/\s+$/, "") ?? ""} ${next[line + 1]?.replace(/^\s+/, "") ?? ""}`.trimEnd();
      next.splice(line, 2, joined);
    }
    return this.edit(
      next,
      { line: this.cursor.line, col: lineLength(next, this.cursor.line) },
      keys,
    );
  }

  private repeatLastChange(): EngineResult {
    if (!this.lastChange || this.replaying) return { changed: true };
    this.replaying = true;
    try {
      for (const key of this.lastChange.keys) this.handleKey(key);
    } finally {
      this.replaying = false;
    }
    return { changed: true };
  }
}
