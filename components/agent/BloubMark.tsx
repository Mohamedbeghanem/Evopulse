"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { blockAt, offsetOf, type Block } from "@/lib/bloub/cycles";
import { NOTIF_BLUE } from "@/lib/bloub/decor";
import { BotEngine, type BotFrame } from "@/lib/bloub/engine";
import { DEMI_VIEWBOX, RAYON } from "@/lib/bloub/repere";
import { mixHex } from "@/lib/bloub/skins";
import { POSES } from "@/lib/bloub/states";

const BODY = "#0D1B24";
const EYES = "#F7F8F5";

export type BloubMood = "idle" | "thinking" | "speaking";

/**
 * `thinking` is the engine state of that name. There is no speaking state, so
 * speaking is a faster montage of the existing wide / wink / idle faces.
 * Idle is a short rest loop; the engine still drifts and blinks inside `idle`.
 */
const CYCLES: Record<BloubMood, Block[]> = {
  idle: [
    { state: "idle", duration: 2.4 },
    { state: "wink", duration: 1.6 },
  ],
  thinking: [{ state: "thinking", duration: 2.6 }],
  speaking: [
    { state: "wide", duration: 0.9 },
    { state: "wink", duration: 0.7 },
    { state: "idle", duration: 0.6 },
  ],
};

function subscribeReduced(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function reducedNow() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function dotFill(dot: BotFrame["dots"][number]) {
  if (dot.color) return dot.color;
  if (dot.depth !== undefined) return mixHex(EYES, BODY, dot.depth);
  return BODY;
}

export function BloubMark({
  size = 36,
  mood = "idle",
  title,
}: {
  size?: number;
  mood?: BloubMood;
  title?: string;
}) {
  const rawId = useId().replace(/:/g, "");
  const maskId = `bloub-${rawId}`;
  const reduced = useSyncExternalStore(subscribeReduced, reducedNow, () => false);
  const engineRef = useRef<BotEngine | null>(null);
  if (engineRef.current === null) engineRef.current = new BotEngine(RAYON, "idle");
  const [frame, setFrame] = useState<BotFrame>(() => engineRef.current!.sample(0));

  useEffect(() => {
    const engine = engineRef.current!;
    const blocks = CYCLES[mood];
    const first = blocks[0]!.state;

    if (reduced) {
      engine.reset(first, 0);
      setFrame(engine.sample(POSES[first]));
      return;
    }

    let raf = 0;
    let last = 0;
    let clock = 0;
    let index = -1;

    const apply = (i: number) => {
      const state = blocks[i]!.state;
      const at = offsetOf(blocks, i);
      if (i < index) engine.reset(state, at);
      else engine.setState(state, at);
      index = i;
    };

    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min((ms - last) / 1000, 0.064) : 0;
      last = ms;
      clock += dt;
      const next = blockAt(blocks, clock).index;
      if (next !== index) apply(next);
      setFrame(engine.sample(clock));
    };

    engine.reset(first, 0);
    index = 0;
    setFrame(engine.sample(0));
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mood, reduced]);

  const vb = DEMI_VIEWBOX;
  const labelled = Boolean(title);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-vb} ${-vb} ${vb * 2} ${vb * 2}`}
      className="shrink-0"
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-vb} y={-vb} width={vb * 2} height={vb * 2}>
          <path d={frame.bodyPath} fill="#fff" />
          {frame.eyes.map((eye, i) => (
            <path key={i} d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="#000" />
          ))}
          {frame.notch ? (
            <circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000" />
          ) : null}
        </mask>
        {frame.arcs.map((arc) => (
          <linearGradient
            key={arc.id}
            id={`${rawId}-${arc.id}`}
            gradientUnits="userSpaceOnUse"
            x1={arc.grad.x1}
            y1={arc.grad.y1}
            x2={arc.grad.x2}
            y2={arc.grad.y2}
          >
            {arc.grad.stops.map((color, i) => (
              <stop
                key={i}
                offset={arc.grad.stops.length === 1 ? 0 : i / (arc.grad.stops.length - 1)}
                stopColor={color}
              />
            ))}
          </linearGradient>
        ))}
      </defs>

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            key={`b${arc.id}`}
            d={arc.back}
            stroke={`url(#${rawId}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </g>

      {frame.dotsBehind
        ? frame.dots.map((dot, i) => <MarkDot key={`pb${i}`} dot={dot} />)
        : null}

      <g opacity={frame.bodyAlpha}>
        <path d={frame.bodyPath} fill={EYES} />
        <g mask={`url(#${maskId})`}>
          <rect x={-vb} y={-vb} width={vb * 2} height={vb * 2} fill={BODY} />
        </g>
      </g>

      {frame.dotsBehind
        ? null
        : frame.dots.map((dot, i) => <MarkDot key={`pf${i}`} dot={dot} />)}

      {frame.notif ? (
        <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill={NOTIF_BLUE} />
      ) : null}

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            key={`f${arc.id}`}
            d={arc.front}
            stroke={`url(#${rawId}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </g>
    </svg>
  );
}

function MarkDot({ dot }: { dot: BotFrame["dots"][number] }) {
  const fill = dotFill(dot);
  if (dot.d) {
    return (
      <path
        d={dot.d}
        fill={fill}
        opacity={dot.opacity}
        transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${RAYON})`}
      />
    );
  }
  return <circle cx={dot.x} cy={dot.y} r={dot.r} fill={fill} opacity={dot.opacity} />;
}
