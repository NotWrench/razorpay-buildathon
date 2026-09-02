import { ImageGround } from "@workspace/ui/components/image-ground";
import { Stagger } from "@workspace/ui/components/motion/stagger";

/**
 * Band 6 — full-bleed, three columns, each with its own drawing.
 *
 * Three claims that are actually true of this build, each with a diagram of
 * the thing it describes rather than an icon standing in for it.
 */

const EDGE = "#4A4A4A";
const DETAIL = "#6E6E6E";
const SHELL = "#2E2E2E";

/** The rule engine: parts as nodes, checks as the edges between them. */
function RuleGraph() {
  const nodes = [
    { cx: 40, cy: 34 },
    { cx: 120, cy: 22 },
    { cx: 196, cy: 44 },
    { cx: 74, cy: 92 },
    { cx: 158, cy: 100 },
  ];

  return (
    <svg
      className="h-full w-full"
      fill="none"
      role="img"
      strokeWidth={1.25}
      viewBox="0 0 240 130"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Parts linked by compatibility rules</title>
      <path
        d="M40 34 L120 22 L196 44 M40 34 L74 92 L158 100 L196 44 M120 22 L74 92 M120 22 L158 100"
        stroke={EDGE}
      />
      {nodes.map((node) => (
        <circle
          cx={node.cx}
          cy={node.cy}
          fill={SHELL}
          key={`${node.cx}-${node.cy}`}
          r={9}
          stroke={DETAIL}
        />
      ))}
    </svg>
  );
}

/** The catalogue: rows of real records, one of them picked out. */
function CatalogueStack() {
  return (
    <svg
      className="h-full w-full"
      fill="none"
      role="img"
      strokeWidth={1.25}
      viewBox="0 0 240 130"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Rows of catalogue records, one selected</title>
      {[0, 1, 2, 3, 4].map((row) => (
        <g key={row}>
          <rect
            fill={row === 2 ? SHELL : "none"}
            height={18}
            rx={4}
            stroke={row === 2 ? DETAIL : EDGE}
            width={176}
            x={32}
            y={16 + row * 22}
          />
          <rect
            fill={row === 2 ? DETAIL : EDGE}
            height={4}
            rx={2}
            width={row === 2 ? 76 : 52}
            x={44}
            y={23 + row * 22}
          />
        </g>
      ))}
    </svg>
  );
}

/** Approval: the total, and a tick that only appears when you click. */
function CheckoutTick() {
  return (
    <svg
      className="h-full w-full"
      fill="none"
      role="img"
      strokeWidth={1.25}
      viewBox="0 0 240 130"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>An order total waiting on approval</title>
      <rect
        fill={SHELL}
        height={78}
        rx={8}
        stroke={EDGE}
        width={148}
        x={46}
        y={26}
      />
      <rect fill={EDGE} height={4} rx={2} width={62} x={62} y={44} />
      <rect fill={DETAIL} height={6} rx={3} width={90} x={62} y={58} />
      <rect fill={EDGE} height={1} width={116} x={62} y={76} />
      <circle cx={78} cy={90} fill="none" r={9} stroke={DETAIL} />
      <path d="M73.5 90 L77 93.5 L83 86.5" stroke={DETAIL} />
      <rect fill={EDGE} height={4} rx={2} width={54} x={96} y={88} />
    </svg>
  );
}

const REASONS = [
  {
    body: [
      "Every check is a named rule with a socket, a wattage or a clearance behind it.",
      "Four states, never a yes or a no — “needs verification” is an answer too.",
    ],
    heading: "Deterministic compatibility",
    visual: <RuleGraph />,
  },
  {
    body: [
      "The assistant only recommends parts that are in this catalogue, in stock, at the listed price.",
      "If it cannot find one, it says so instead of inventing it.",
    ],
    heading: "Grounded recommendations",
    visual: <CatalogueStack />,
  },
  {
    body: [
      "Nothing is added, removed or charged on the assistant's say-so.",
      "Every proposed change waits behind a button you press.",
    ],
    heading: "Nothing charged without approval",
    visual: <CheckoutTick />,
  },
];

function WhyBand() {
  return (
    <section className="w-full bg-carbon py-24 lg:py-28">
      <Stagger className="mx-auto grid w-full max-w-[1440px] gap-12 px-5 sm:px-8 md:grid-cols-3 lg:px-10 2xl:px-16">
        {REASONS.map((reason) => (
          <div key={reason.heading}>
            <ImageGround className="aspect-[16/9] p-8">
              {reason.visual}
            </ImageGround>
            <h3 className="mt-7 font-display font-medium text-[17px] text-bone uppercase tracking-[0.05em]">
              {reason.heading}
            </h3>
            {reason.body.map((line) => (
              <p
                className="mt-3 max-w-[42ch] text-[15px] text-smoke"
                key={line}
              >
                {line}
              </p>
            ))}
          </div>
        ))}
      </Stagger>
    </section>
  );
}

export { WhyBand };
