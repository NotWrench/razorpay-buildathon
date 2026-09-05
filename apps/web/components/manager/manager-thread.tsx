"use client";

import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import { StreamedText } from "@/components/chat/streamed-text";
import { FindingsList } from "@/components/manager/findings-list";
import type { ManagerResult, ManagerTable } from "@/lib/data/manager-chat";

/**
 * The manager's thread — the storefront's, without the product cards.
 *
 * An operator asking about stock does not want three renders on a riser; they
 * want the table they would have had to build themselves. So a result here is
 * either a table or the same finding rows the summary uses, and never a
 * shopping surface.
 */

export interface ManagerTurn {
  id: string;
  question: string;
  reply: string;
  result: ManagerResult;
}

function ResultTable({ table }: { table: ManagerTable }) {
  return (
    <div className="mt-5">
      <Label>{table.title}</Label>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {table.columns.map((heading, index) => (
                <th
                  className={cn(
                    "py-2.5 font-normal",
                    index === 0 ? "text-left" : "text-right"
                  )}
                  key={heading}
                  scope="col"
                >
                  <Label>{heading}</Label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr
                className="transition-colors duration-micro hover:bg-panel"
                key={row.join("|")}
              >
                {row.map((cell, index) => (
                  <td
                    className={cn(
                      /* 16px rhythm: this side of the product is denser than
                         the storefront on purpose. */
                      "t-body py-2.5 text-bone",
                      table.numeric.includes(index)
                        ? "text-right font-mono tabular-nums"
                        : "text-left"
                    )}
                    key={`${row[0]}-${column(table, index)}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function column(table: ManagerTable, index: number): string {
  return table.columns[index] ?? String(index);
}

function ManagerThread({
  shown,
  streaming,
  turns,
}: {
  shown: number;
  streaming: boolean;
  turns: ManagerTurn[];
}) {
  return (
    <div className="grid gap-10">
      {turns.map((turn, index) => {
        const last = index === turns.length - 1;

        return (
          <div className="chat-turn" key={turn.id}>
            {/* The question is a block, not a line of grey text above one.
                Two turns of plain paragraphs read as four paragraphs. */}
            <div className="flex justify-end">
              <p className="t-body-sm max-w-[80%] rounded-[18px] rounded-br-[6px] bg-riser px-4 py-2.5 text-bone">
                {turn.question}
              </p>
            </div>

            <div className="mt-5">
              <StreamedText
                className="t-body"
                id={turn.id}
                shown={last ? shown : turn.reply.split(" ").length}
                streaming={last && streaming}
                text={turn.reply}
              />

              {turn.result.kind === "table" ? (
                <ResultTable table={turn.result.table} />
              ) : null}

              {turn.result.kind === "findings" ? (
                <div className="mt-5">
                  <FindingsList
                    findings={turn.result.findings}
                    title="Findings"
                  />
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { ManagerThread };
