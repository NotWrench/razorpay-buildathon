/**
 * Six points, drawn small.
 *
 * Bone at full strength on a faint riser fill, not a hairline on grey — the
 * shape is the whole point of the mark, and a line you have to lean in for is
 * decoration. No axes, no dots, no tooltip: it says "rising" or "flat", and
 * anything more precise is the number sitting next to it.
 */

const WIDTH = 56;
const HEIGHT = 18;

function path(points: number[]): { fill: string; line: string } {
  const highest = Math.max(...points);
  const lowest = Math.min(...points);
  const span = highest - lowest || 1;
  const step = WIDTH / (points.length - 1 || 1);

  const coordinates = points.map((value, index) => {
    const x = index * step;
    const y = HEIGHT - ((value - lowest) / span) * (HEIGHT - 2) - 1;

    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return {
    fill: `M0,${HEIGHT} L${coordinates.join(" L")} L${WIDTH},${HEIGHT} Z`,
    line: `M${coordinates.join(" L")}`,
  };
}

function TrendLine({ points }: { points: number[] }) {
  const { fill, line } = path(points);

  return (
    <svg
      aria-hidden
      className="shrink-0"
      fill="none"
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
    >
      <path d={fill} fill="var(--riser)" />
      <path
        d={line}
        stroke="var(--bone)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.25"
      />
    </svg>
  );
}

export { TrendLine };
