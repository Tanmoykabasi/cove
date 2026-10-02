import { memo, type ReactNode } from "react";
import { inlineFormat, parseBlocks, type Block, type ListItem } from "@/lib/chat/markdown";
import { cn } from "@/lib/utils";

/**
 * Renders the formatting contract in `src/lib/chat/formatting.ts`.
 *
 * Parsing lives in `@/lib/chat/markdown` - React-free and unit-tested, so the
 * contract cannot drift from what is actually rendered. This file is only the
 * view layer.
 */

const HEADING_CLASS: Record<number, string> = {
  1: "font-display text-xl font-semibold tracking-tight",
  2: "font-display text-lg font-semibold tracking-tight",
  3: "text-base font-semibold",
  4: "text-sm font-semibold",
  5: "text-sm font-semibold",
  6: "text-sm font-semibold",
};

function Inline({ text }: { text: string }) {
  return <span dangerouslySetInnerHTML={{ __html: inlineFormat(text) }} />;
}

function ListBlock({ ordered, items }: { ordered: boolean; items: ListItem[] }) {
  const isTaskList = items.some((item) => item.task !== null);
  const ListTag = ordered ? "ol" : "ul";

  return (
    <ListTag
      className={cn(
        "space-y-1 pl-5",
        ordered && "list-decimal",
        !ordered && !isTaskList && "list-disc",
        isTaskList && "list-none pl-0",
      )}
    >
      {items.map((item, index) => (
        <li key={index} className={cn(isTaskList && "flex gap-2")}>
          {item.task !== null ? (
            <span aria-hidden className="mt-px shrink-0 font-mono text-xs text-subtle">
              {item.task ? "☑" : "☐"}
            </span>
          ) : null}
          <span className="min-w-0">
            <Inline text={item.text} />
            {item.children.length > 0 ? (
              <div className="mt-1">
                <ListBlock ordered={false} items={item.children} />
              </div>
            ) : null}
          </span>
        </li>
      ))}
    </ListTag>
  );
}

function BlockView({ block }: { block: Block }): ReactNode {
  switch (block.type) {
    case "code":
      return (
        <div className="overflow-hidden rounded-lg bg-surface-2 shadow-[var(--shadow-border)]">
          {block.lang ? (
            <div className="border-b border-border px-3 py-1.5 font-mono text-[0.7rem] text-subtle">
              {block.lang}
            </div>
          ) : null}
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-fg">
            <code>{block.code.replace(/\n$/, "")}</code>
          </pre>
        </div>
      );

    case "heading": {
      const Tag = `h${Math.min(block.level + 1, 6)}` as "h2";
      return (
        <Tag className={cn(HEADING_CLASS[block.level] ?? HEADING_CLASS[6], "text-balance text-fg")}>
          <Inline text={block.text} />
        </Tag>
      );
    }

    case "rule":
      return <hr className="border-border" />;

    case "quote":
      return (
        <blockquote className="border-l-2 border-border pl-3 whitespace-pre-wrap text-muted">
          <Inline text={block.lines.join("\n")} />
        </blockquote>
      );

    case "table":
      return (
        <div className="overflow-x-auto rounded-lg shadow-[var(--shadow-border)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {block.head.map((cell, index) => (
                  <th
                    key={index}
                    scope="col"
                    className="border-b border-border bg-surface-2 px-3 py-2 text-left font-medium text-fg"
                  >
                    <Inline text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="border-b border-border/60 px-3 py-2 align-top text-muted"
                    >
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "list":
      return <ListBlock ordered={block.ordered} items={block.items} />;

    case "paragraph":
      return (
        <p className="whitespace-pre-wrap">
          <Inline text={block.lines.join("\n")} />
        </p>
      );
  }
}

/**
 * Memoized because `Thread` re-renders every message on each streamed token -
 * without this, every completed message in the transcript re-parses its whole
 * markdown body on every delta.
 */
export const Markdown = memo(function Markdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseBlocks(text);
  return (
    <div className={cn("space-y-3 text-pretty text-sm leading-relaxed text-fg", className)}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
});
