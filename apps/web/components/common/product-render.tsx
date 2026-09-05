import type { CategorySlug } from "@workspace/db/taxonomy";
import { cn } from "@workspace/ui/lib/utils";
import { ImageWithFallback } from "@/components/common/image-with-fallback";

/**
 * Every product image in the build.
 *
 * A product with a photograph gets the photograph; a product without one
 * draws itself — a monochrome line render per category, on a transparent
 * ground, sized to its container. v3 is image-led, so an empty `image_url`
 * has to produce something rather than a hole, and it does.
 *
 * `sizes` is required by `next/image` under `fill` and there is no honest
 * default: the same component draws a 40px row thumbnail and a half-viewport
 * gallery frame. Callers that know their box say so; the fallback assumes a
 * card, which is where most of these are.
 */

/*
 * On the tokens, not on three hexes picked by eye. These are read straight
 * into SVG `fill` and `stroke` attributes, which take a var() the same as any
 * CSS colour does, so the drawings follow the palette instead of drifting out
 * of it the next time the ground changes.
 */
const SHELL = "var(--render-shell)";
const EDGE = "var(--render-edge)";
const DETAIL = "var(--render-detail)";

interface ProductRenderProps {
  alt: string;
  category: CategorySlug;
  className?: string;
  /** Roughly how wide this will be drawn, for the srcset. */
  sizes?: string;
  /** The product's photograph. The line render stands in when it is absent. */
  src?: string;
}

const DEFAULT_SIZES =
  "(min-width: 1280px) 400px, (min-width: 768px) 45vw, 90vw";

function Fan({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} fill={SHELL} r={r} stroke={EDGE} />
      <circle cx={cx} cy={cy} fill="none" r={r * 0.62} stroke={DETAIL} />
      <circle cx={cx} cy={cy} fill={EDGE} r={r * 0.18} />
    </g>
  );
}

const ARTWORK: Record<CategorySlug, React.ReactNode> = {
  case: (
    <g>
      <rect
        fill={SHELL}
        height={118}
        rx={6}
        stroke={EDGE}
        width={78}
        x={81}
        y={21}
      />
      <rect
        fill="none"
        height={100}
        rx={3}
        stroke={DETAIL}
        width={44}
        x={98}
        y={30}
      />
      <Fan cx={120} cy={50} r={13} />
      <Fan cx={120} cy={82} r={13} />
      <Fan cx={120} cy={114} r={13} />
      <rect fill={DETAIL} height={3} rx={1.5} width={18} x={88} y={26} />
    </g>
  ),
  cooler: (
    <g>
      <rect
        fill={SHELL}
        height={64}
        rx={4}
        stroke={EDGE}
        width={92}
        x={74}
        y={38}
      />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
        <line
          key={index}
          stroke={DETAIL}
          x1={82 + index * 11}
          x2={82 + index * 11}
          y1={42}
          y2={98}
        />
      ))}
      <rect fill={EDGE} height={12} rx={3} width={60} x={90} y={104} />
      <rect
        fill={SHELL}
        height={8}
        rx={2}
        stroke={EDGE}
        width={36}
        x={102}
        y={116}
      />
    </g>
  ),
  cpu: (
    <g>
      <rect
        fill={SHELL}
        height={86}
        rx={5}
        stroke={EDGE}
        width={86}
        x={77}
        y={37}
      />
      <rect
        fill="none"
        height={54}
        rx={3}
        stroke={DETAIL}
        width={54}
        x={93}
        y={53}
      />
      <path d="M93 53 L119 79 L147 53" fill="none" stroke={DETAIL} />
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <g key={index}>
          <line
            stroke={EDGE}
            x1={77}
            x2={69}
            y1={49 + index * 13}
            y2={49 + index * 13}
          />
          <line
            stroke={EDGE}
            x1={163}
            x2={171}
            y1={49 + index * 13}
            y2={49 + index * 13}
          />
        </g>
      ))}
    </g>
  ),
  fan: (
    <g>
      <rect
        fill={SHELL}
        height={92}
        rx={8}
        stroke={EDGE}
        width={92}
        x={74}
        y={34}
      />
      <Fan cx={120} cy={80} r={38} />
      {[0, 1, 2, 3, 4, 5, 6].map((index) => (
        <path
          d={`M120 80 L${120 + 34 * Math.cos((index * 2 * Math.PI) / 7)} ${
            80 + 34 * Math.sin((index * 2 * Math.PI) / 7)
          }`}
          key={index}
          stroke={DETAIL}
        />
      ))}
    </g>
  ),
  gpu: (
    <g>
      <rect
        fill={SHELL}
        height={62}
        rx={5}
        stroke={EDGE}
        width={184}
        x={28}
        y={44}
      />
      <Fan cx={78} cy={75} r={22} />
      <Fan cx={124} cy={75} r={22} />
      <Fan cx={170} cy={75} r={22} />
      <rect fill={EDGE} height={10} rx={2} width={64} x={64} y={106} />
      <rect fill={DETAIL} height={5} rx={2} width={22} x={182} y={36} />
    </g>
  ),
  monitor: (
    <g>
      <rect
        fill={SHELL}
        height={82}
        rx={5}
        stroke={EDGE}
        width={156}
        x={42}
        y={26}
      />
      <rect
        fill="none"
        height={68}
        rx={2}
        stroke={DETAIL}
        width={142}
        x={49}
        y={33}
      />
      <rect fill={EDGE} height={22} width={14} x={113} y={108} />
      <rect
        fill={SHELL}
        height={7}
        rx={3}
        stroke={EDGE}
        width={72}
        x={84}
        y={128}
      />
    </g>
  ),
  motherboard: (
    <g>
      <rect
        fill={SHELL}
        height={110}
        rx={5}
        stroke={EDGE}
        width={130}
        x={55}
        y={25}
      />
      <rect fill="none" height={30} stroke={DETAIL} width={30} x={70} y={38} />
      {[0, 1, 2, 3].map((index) => (
        <rect
          fill={EDGE}
          height={40}
          key={index}
          rx={1}
          width={5}
          x={116 + index * 10}
          y={35}
        />
      ))}
      {[0, 1].map((index) => (
        <rect
          fill={DETAIL}
          height={5}
          key={index}
          rx={1}
          width={90}
          x={68}
          y={92 + index * 16}
        />
      ))}
      {[0, 1, 2, 3].map((index) => (
        <circle
          cx={index % 2 === 0 ? 62 : 178}
          cy={index < 2 ? 32 : 128}
          fill="none"
          key={index}
          r={2.5}
          stroke={DETAIL}
        />
      ))}
    </g>
  ),
  peripheral: (
    <g>
      <rect
        fill={SHELL}
        height={62}
        rx={7}
        stroke={EDGE}
        width={168}
        x={36}
        y={49}
      />
      {[0, 1, 2].map((row) => (
        <g key={row}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((column) => (
            <rect
              fill={row === 1 && column === 4 ? DETAIL : EDGE}
              height={11}
              key={column}
              rx={2}
              width={11}
              x={46 + column * 13}
              y={57 + row * 15}
            />
          ))}
        </g>
      ))}
    </g>
  ),
  psu: (
    <g>
      <rect
        fill={SHELL}
        height={78}
        rx={5}
        stroke={EDGE}
        width={124}
        x={58}
        y={41}
      />
      <Fan cx={106} cy={80} r={28} />
      <rect fill={EDGE} height={26} rx={2} width={12} x={158} y={56} />
      <rect fill={EDGE} height={16} rx={2} width={12} x={158} y={90} />
    </g>
  ),
  ram: (
    <g>
      <rect
        fill={SHELL}
        height={52}
        rx={4}
        stroke={EDGE}
        width={176}
        x={32}
        y={54}
      />
      <rect fill={DETAIL} height={16} rx={2} width={152} x={44} y={62} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((index) => (
        <rect
          fill={EDGE}
          height={8}
          key={index}
          width={7}
          x={44 + index * 11}
          y={98}
        />
      ))}
    </g>
  ),
  storage: (
    <g>
      <rect
        fill={SHELL}
        height={34}
        rx={3}
        stroke={EDGE}
        width={168}
        x={36}
        y={63}
      />
      <rect fill={DETAIL} height={20} rx={2} width={54} x={48} y={70} />
      <rect fill={DETAIL} height={20} rx={2} width={40} x={112} y={70} />
      <rect fill={EDGE} height={12} width={5} x={192} y={72} />
      <rect fill={EDGE} height={12} width={5} x={200} y={72} />
      <circle cx={44} cy={80} fill="none" r={4} stroke={DETAIL} />
    </g>
  ),
};

/**
 * Every drawing is laid out in one 240x160 space so the shapes stay in
 * proportion to each other, then cropped to its own artwork. Without the crop
 * a tower — which is tall and narrow — would sit as a small object in the
 * middle of a landscape box on every card it appears on.
 */
const CROP: Record<CategorySlug, string> = {
  case: "74 14 92 132",
  cooler: "68 32 104 98",
  cpu: "63 31 114 98",
  fan: "68 28 104 104",
  gpu: "22 30 196 92",
  monitor: "36 20 168 121",
  motherboard: "49 19 142 122",
  peripheral: "30 43 180 74",
  psu: "52 35 136 90",
  ram: "26 48 188 64",
  storage: "30 57 181 46",
};

/** The category drawing, on its own, at whatever size its box gives it. */
function LineRender({
  alt,
  category,
  className,
}: {
  alt: string;
  category: CategorySlug;
  className?: string;
}) {
  return (
    <svg
      className={cn("h-full w-full", className)}
      fill="none"
      role="img"
      strokeWidth={1.25}
      viewBox={CROP[category]}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{alt}</title>
      {ARTWORK[category]}
    </svg>
  );
}

function ProductRender({
  alt,
  category,
  className,
  sizes,
  src,
}: ProductRenderProps) {
  if (src) {
    /*
     * Contained, inside whatever padding the caller's ground carries.
     *
     * Everything that reaches this branch is a *catalogue* photograph — a
     * product shot on white, from `image_url`. Cropping one to fill its box
     * crops through the product, so it sits inside the box with air around it.
     * The site's own photography wants the opposite treatment and goes through
     * `PhotoGround`, which fills the frame edge to edge.
     *
     * `shrink-0` is load-bearing: this wrapper's only content is an absolutely
     * positioned image, so its content width is zero and, as a flex child of
     * the ground, `w-full` would otherwise lose to `flex-shrink`. That is what
     * once rendered the assistant band's machine at 0px wide.
     */
    return (
      <div className={cn("relative h-full w-full shrink-0", className)}>
        {/*
         * A catalogue URL that has rotted falls back to the drawing rather
         * than to a broken image. The fallback is built here, on the server,
         * so the artwork never reaches the client bundle.
         */}
        <ImageWithFallback
          alt={alt}
          className="object-contain"
          fallback={<LineRender alt={alt} category={category} />}
          fill
          key={src}
          sizes={sizes ?? DEFAULT_SIZES}
          src={src}
        />
      </div>
    );
  }

  return <LineRender alt={alt} category={category} className={className} />;
}

export { ProductRender };
