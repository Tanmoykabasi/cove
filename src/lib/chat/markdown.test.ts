import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FORMATTING_RULES } from "./formatting.ts";
import { inlineFormat, parseBlocks, safeHref } from "./markdown.ts";

/**
 * Guards the formatting contract.
 *
 * The first test is the important one: it fails if a rule is added to
 * FORMATTING_RULES without a matching expectation here, which is how the
 * renderer and the instructions sent to the model are kept from drifting apart.
 */

type Expectation = { kind: "inline"; contains: string } | { kind: "block"; type: string };

const EXPECTATIONS: Record<string, Expectation> = {
  Bold: { kind: "inline", contains: "<strong" },
  Italic: { kind: "inline", contains: "<em" },
  "Bold italic": { kind: "inline", contains: "<strong><em>" },
  Strikethrough: { kind: "inline", contains: "<del" },
  "Inline code": { kind: "inline", contains: "<code" },
  "Code block": { kind: "block", type: "code" },
  Headings: { kind: "block", type: "heading" },
  "Bulleted list": { kind: "block", type: "list" },
  "Numbered list": { kind: "block", type: "list" },
  "Nested list": { kind: "block", type: "list" },
  "Task list": { kind: "block", type: "list" },
  Blockquote: { kind: "block", type: "quote" },
  Table: { kind: "block", type: "table" },
  Divider: { kind: "block", type: "rule" },
  Link: { kind: "inline", contains: "<a " },
};

describe("formatting contract", () => {
  it("has an expectation for every documented rule", () => {
    const documented = FORMATTING_RULES.map((rule) => rule.name).sort();
    const covered = Object.keys(EXPECTATIONS).sort();
    assert.deepEqual(
      covered,
      documented,
      "FORMATTING_RULES and EXPECTATIONS are out of sync - every documented rule needs a parser expectation",
    );
  });

  for (const rule of FORMATTING_RULES) {
    it(`renders ${rule.name}`, () => {
      const expectation = EXPECTATIONS[rule.name];
      assert.ok(expectation, `no expectation defined for ${rule.name}`);

      if (expectation.kind === "inline") {
        const html = inlineFormat(rule.example);
        assert.ok(
          html.includes(expectation.contains),
          `${rule.name}: expected ${expectation.contains} in ${JSON.stringify(html)}`,
        );
        return;
      }

      const blocks = parseBlocks(rule.example);
      assert.ok(
        blocks.some((block) => block.type === expectation.type),
        `${rule.name}: expected a ${expectation.type} block, got ${blocks.map((b) => b.type).join(", ")}`,
      );
    });
  }
});

describe("inlineFormat", () => {
  it("escapes HTML before decorating, so markup cannot be injected", () => {
    const html = inlineFormat('<img src=x onerror="alert(1)">');
    assert.ok(!html.includes("<img"));
    assert.ok(html.includes("&lt;img"));
  });

  it("leaves markup inside code spans literal", () => {
    const html = inlineFormat("`**not bold**`");
    assert.ok(html.includes("<code"));
    assert.ok(html.includes("**not bold**"));
    assert.ok(!html.includes("<strong"));
  });

  it("treats ** and __ as bold, * and _ as italic", () => {
    assert.ok(inlineFormat("**a**").includes("<strong"));
    assert.ok(inlineFormat("__a__").includes("<strong"));
    assert.ok(inlineFormat(" *a* ").includes("<em"));
    assert.ok(inlineFormat(" _a_ ").includes("<em"));
  });

  it("matches *** as bold italic rather than consuming it as bold", () => {
    const html = inlineFormat("***both***");
    assert.ok(html.includes("<strong><em>both</em></strong>"), html);
  });

  it("does not linkify non-http schemes", () => {
    const html = inlineFormat("[click](javascript:alert(1))");
    assert.ok(!html.includes("<a "), html);
    assert.equal(safeHref("javascript:alert(1)"), null);
    assert.equal(safeHref("https://example.com"), "https://example.com");
  });

  it("autolinks bare http(s) URLs", () => {
    const html = inlineFormat("see https://example.com now");
    assert.ok(html.includes('href="https://example.com"'), html);
  });

  it("escapes a quote in a link target", () => {
    assert.equal(safeHref('https://example.com/a"b'), "https://example.com/a%22b");
  });
});

describe("parseBlocks", () => {
  it("renders numbered lists as ordered and bullets as unordered", () => {
    const [ordered] = parseBlocks("1. one\n2. two");
    const [unordered] = parseBlocks("- one\n- two");
    assert.equal(ordered?.type === "list" && ordered.ordered, true);
    assert.equal(unordered?.type === "list" && unordered.ordered, false);
  });

  it("accepts 1) as a numbered list too", () => {
    const [block] = parseBlocks("1) one\n2) two");
    assert.equal(block?.type === "list" && block.ordered, true);
  });

  it("nests indented items under their parent", () => {
    const [block] = parseBlocks("- parent\n  - child\n- sibling");
    assert.equal(block?.type, "list");
    if (block?.type !== "list") return;
    assert.equal(block.items.length, 2);
    assert.equal(block.items[0]?.children.length, 1);
    assert.equal(block.items[0]?.children[0]?.text, "child");
    assert.equal(block.items[1]?.text, "sibling");
  });

  it("reads task list state", () => {
    const [block] = parseBlocks("- [x] done\n- [ ] open");
    assert.equal(block?.type, "list");
    if (block?.type !== "list") return;
    assert.deepEqual(
      block.items.map((item) => item.task),
      [true, false],
    );
  });

  it("parses a table with header and rows", () => {
    const [block] = parseBlocks("| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |");
    assert.equal(block?.type, "table");
    if (block?.type !== "table") return;
    assert.deepEqual(block.head, ["A", "B"]);
    assert.deepEqual(block.rows, [
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("captures a fence language tag and body", () => {
    const [block] = parseBlocks("```ts\nconst x = 1;\n```");
    assert.equal(block?.type, "code");
    if (block?.type !== "code") return;
    assert.equal(block.lang, "ts");
    assert.equal(block.code, "const x = 1;");
  });

  it("does not treat a fence body as markdown", () => {
    const blocks = parseBlocks("```\n# not a heading\n- not a list\n```");
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]?.type, "code");
  });

  it("maps heading levels and caps at six", () => {
    const blocks = parseBlocks("# a\n\n## b\n\n###### c\n\n####### d");
    // 7+ hashes is not a heading (matches CommonMark); it falls through to text.
    assert.deepEqual(
      blocks.map((block) => (block.type === "heading" ? block.level : -1)),
      [1, 2, 6, -1],
    );
    assert.equal(blocks[3]?.type, "paragraph");
  });

  it("separates blocks with a blank line", () => {
    const types = parseBlocks("para one\n\n---\n\n> quote").map((block) => block.type);
    assert.deepEqual(types, ["paragraph", "rule", "quote"]);
  });

  it("keeps a paragraph's own line breaks", () => {
    const [block] = parseBlocks("line one\nline two");
    assert.equal(block?.type, "paragraph");
    if (block?.type !== "paragraph") return;
    assert.deepEqual(block.lines, ["line one", "line two"]);
  });

  it("does not mistake a bulleted paragraph for a rule", () => {
    const blocks = parseBlocks("- a\n- b");
    assert.equal(blocks[0]?.type, "list");
  });
});
