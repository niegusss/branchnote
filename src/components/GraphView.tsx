import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Network, X } from "lucide-react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { GraphEdge, GraphNode } from "../lib/graph";

interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Open a note by its vault-relative path. */
  onOpenFile: (relPath: string) => void;
  onClose: () => void;
}

interface SimNode extends GraphNode, SimulationNodeDatum {}
type SimLink = SimulationLinkDatum<SimNode>;

const nodeRadius = (degree: number) => 5 + Math.sqrt(degree) * 3;

/** Force-directed graph of the whole vault: notes are nodes, `[[links]]` edges.
 *  The simulation runs live (gentle drift), auto-fits on load; drag to pan,
 *  scroll to zoom, click a node to open it. */
export function GraphView({ nodes, edges, onOpenFile, onClose }: GraphViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const simNodes = useRef<SimNode[]>([]);
  const simLinks = useRef<SimLink[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const [, forceRender] = useState(0);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });

  // Pan bookkeeping; `moved` distinguishes a drag from a click (persists past
  // pointerup until the next pointerdown, so a node click reads the right value).
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const moved = useRef(false);

  // Track the container size so the graph can be centred/fitted.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build + run the live simulation when the data (or container size) changes.
  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    if (nodes.length === 0) {
      simNodes.current = [];
      simLinks.current = [];
      forceRender((n) => n + 1);
      return;
    }

    const ns: SimNode[] = nodes.map((n) => ({ ...n }));
    const ls: SimLink[] = edges.map((e) => ({ source: e.source, target: e.target }));
    const sim = forceSimulation<SimNode>(ns)
      .force("charge", forceManyBody<SimNode>().strength(-120).distanceMax(360))
      .force(
        "link",
        forceLink<SimNode, SimLink>(ls)
          .id((d) => d.id)
          .distance(46)
          .strength(0.6),
      )
      .force("center", forceCenter(0, 0))
      .force("x", forceX(0).strength(0.06))
      .force("y", forceY(0).strength(0.06))
      .force("collide", forceCollide<SimNode>().radius((d) => nodeRadius(d.degree) + 6))
      .velocityDecay(0.55)
      .alphaDecay(0.02)
      .stop();

    // Pre-settle a bit so the first paint is already laid out, then fit it.
    for (let i = 0; i < 220; i++) sim.tick();
    simNodes.current = ns;
    simLinks.current = ls;
    fit(ns);

    // Keep the simulation slightly warm for a gentle, continuous drift.
    sim.alphaTarget(0.015).alpha(0.2).restart();
    simRef.current = sim;
    let raf = 0;
    const loop = () => {
      sim.tick();
      forceRender((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, size.w, size.h]);

  /** Center + zoom so the whole graph fits the viewport (with padding). */
  function fit(ns: SimNode[]) {
    const xs = ns.map((n) => n.x ?? 0);
    const ys = ns.map((n) => n.y ?? 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 70;
    const gw = maxX - minX || 1;
    const gh = maxY - minY || 1;
    const k = Math.max(0.2, Math.min((size.w - pad * 2) / gw, (size.h - pad * 2) / gh, 1.4));
    const gcx = (minX + maxX) / 2;
    const gcy = (minY + maxY) / 2;
    setView({ k, x: -k * gcx, y: -k * gcy });
  }

  function onWheel(e: React.WheelEvent) {
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setView((v) => ({ ...v, k: Math.min(4, Math.max(0.1, v.k * factor)) }));
  }
  function onPointerDown(e: React.PointerEvent) {
    drag.current = { px: e.clientX, py: e.clientY, ox: view.x, oy: view.y };
    moved.current = false;
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
    setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
  }
  function endPan() {
    drag.current = null;
  }

  const cx = size.w / 2 + view.x;
  const cy = size.h / 2 + view.y;

  return (
    <section aria-label="Graph view" className="flex min-w-0 flex-1 flex-col bg-bg">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Network size={14} className="text-muted" aria-hidden />
          Graph
          <span className="ml-2 text-xs font-normal text-faint">
            {nodes.length} {nodes.length === 1 ? "note" : "notes"} · {edges.length} links
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          title="Close graph"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95"
        >
          <X size={15} aria-hidden />
          <span className="sr-only">Close graph</span>
        </button>
      </header>

      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
        {nodes.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-faint">
            No notes to graph yet.
          </p>
        ) : (
          <svg
            className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPan}
            onPointerLeave={endPan}
          >
            <g transform={`translate(${cx} ${cy}) scale(${view.k})`}>
              {simLinks.current.map((l, i) => {
                const s = l.source as SimNode;
                const t = l.target as SimNode;
                return (
                  <line
                    key={i}
                    x1={s.x ?? 0}
                    y1={s.y ?? 0}
                    x2={t.x ?? 0}
                    y2={t.y ?? 0}
                    className="stroke-line-strong"
                    strokeWidth={1 / view.k}
                  />
                );
              })}
              {simNodes.current.map((n) => {
                const r = nodeRadius(n.degree);
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x ?? 0} ${n.y ?? 0})`}
                    className="cursor-pointer"
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      endPan();
                      if (!moved.current) onOpenFile(n.id);
                    }}
                  >
                    <circle r={r} className="fill-accent stroke-bg" strokeWidth={1.5 / view.k}>
                      <title>{n.name}</title>
                    </circle>
                    <text
                      y={r + 11 / view.k}
                      textAnchor="middle"
                      className="pointer-events-none fill-muted"
                      style={{ fontSize: 11 / view.k }}
                    >
                      {n.name.length > 22 ? n.name.slice(0, 21) + "…" : n.name}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-faint">
          Drag to pan · scroll to zoom · click a node to open
        </p>
      </div>
    </section>
  );
}
