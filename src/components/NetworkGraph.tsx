import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { GraphNode, NetworkGraph as GraphModel } from '../core/network';
import { edgeExplanation, edgeLabel } from '../core/network';
import type { ThemeId } from '../core/types';
import { Icon } from './Icon';

interface Positioned extends GraphNode {
  x: number;
  y: number;
}

interface Offset {
  dx: number;
  dy: number;
}

interface Camera {
  x: number;
  y: number;
  k: number;
}

const WIDTH = 1000;
const HEIGHT = 660;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.6;
const DEFAULT_CAMERA: Camera = { x: 0, y: 0, k: 1 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function angleFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return (hash / 360) * Math.PI * 2;
}

function hashFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 997;
  return hash;
}

function layoutGraph(graph: GraphModel): Record<string, Positioned> {
  const positions: Record<string, Positioned> = {};
  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;
  const nodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const self = nodes.find((n) => n.type === 'self');
  if (self) positions[self.id] = { ...self, x: centerX, y: centerY };

  const communities = nodes.filter((n) => n.type === 'community');
  communities.forEach((node, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, communities.length)) * Math.PI * 2;
    const radius = communities.length <= 1 ? 0 : 206;
    positions[node.id] = {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });

  const projects = nodes.filter((n) => n.type === 'project');
  projects.forEach((node) => {
    const community = node.communityId ? positions[node.communityId] : undefined;
    const angle = angleFor(node.id);
    positions[node.id] = {
      ...node,
      x: (community?.x ?? centerX) + Math.cos(angle) * 76,
      y: (community?.y ?? centerY) + Math.sin(angle) * 76,
    };
  });

  const persons = nodes.filter((n) => n.type === 'person');
  const clusters = new Map<string, GraphNode[]>();
  for (const cluster of graph.clusters) {
    for (const id of cluster.nodeIds) {
      const member = graph.nodes.find((n) => n.id === id);
      if (member?.type !== 'person') continue;
      const list = clusters.get(cluster.communityId) ?? [];
      list.push(member);
      clusters.set(cluster.communityId, list);
    }
  }
  const placed = new Set<string>();
  for (const [communityId, members] of clusters) {
    const hub = positions[communityId];
    if (!hub) continue;
    members.forEach((member, index) => {
      const angle = angleFor(member.id) + (index / Math.max(members.length, 1)) * Math.PI;
      positions[member.id] = {
        ...member,
        x: hub.x + Math.cos(angle) * (112 + (index % 2) * 24),
        y: hub.y + Math.sin(angle) * (92 + (index % 2) * 20),
      };
      placed.add(member.id);
    });
  }
  persons.forEach((node, index) => {
    if (placed.has(node.id)) return;
    const angle = angleFor(node.id) + (index / Math.max(persons.length, 1)) * Math.PI;
    positions[node.id] = {
      ...node,
      x: centerX + Math.cos(angle) * 300,
      y: centerY + Math.sin(angle) * 224,
    };
  });

  for (const id of Object.keys(positions)) {
    positions[id].x += (angleFor(`${id}x`) / (Math.PI * 2) - 0.5) * 26;
    positions[id].y += (angleFor(`${id}y`) / (Math.PI * 2) - 0.5) * 26;
  }

  const nodeIndex = nodes.map((n) => n.id);
  for (let iteration = 0; iteration < 240; iteration += 1) {
    const forces: Record<string, { x: number; y: number }> = {};
    for (const id of nodeIndex) forces[id] = { x: 0, y: 0 };

    for (let i = 0; i < nodeIndex.length; i += 1) {
      for (let j = i + 1; j < nodeIndex.length; j += 1) {
        const a = positions[nodeIndex[i]];
        const b = positions[nodeIndex[j]];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        if (dx === 0 && dy === 0) {
          dx = 0.01;
          dy = 0.01;
        }
        const distanceSq = dx * dx + dy * dy;
        const distance = Math.sqrt(distanceSq) || 0.01;
        const repel = Math.min(16, 5400 / (distanceSq + 120));
        forces[a.id].x += (dx / distance) * repel;
        forces[a.id].y += (dy / distance) * repel;
        forces[b.id].x -= (dx / distance) * repel;
        forces[b.id].y -= (dy / distance) * repel;
      }
    }

    for (const edge of graph.edges) {
      const a = positions[edge.source];
      const b = positions[edge.target];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const rest =
        edge.type === 'membership'
          ? 110
          : edge.type === 'project'
            ? 86
            : edge.type === 'relationship-active'
              ? 170
              : 152;
      const strength = edge.type === 'membership' ? 0.02 : 0.012;
      const spring = (distance - rest) * strength;
      forces[a.id].x += (dx / distance) * spring;
      forces[a.id].y += (dy / distance) * spring;
      forces[b.id].x -= (dx / distance) * spring;
      forces[b.id].y -= (dy / distance) * spring;
    }

    for (const id of nodeIndex) {
      const node = positions[id];
      const gravity = node.type === 'self' ? 0.02 : node.type === 'community' ? 0.006 : 0.004;
      forces[id].x += (centerX - node.x) * gravity;
      forces[id].y += (centerY - node.y) * gravity;
      node.x = Math.max(62, Math.min(WIDTH - 62, node.x + forces[id].x));
      node.y = Math.max(56, Math.min(HEIGHT - 58, node.y + forces[id].y));
    }
  }

  return positions;
}

function nodeRadius(node: GraphNode): number {
  switch (node.type) {
    case 'self':
      return 22;
    case 'community':
      return 28;
    case 'project':
      return 17;
    default:
      return 15;
  }
}

function shortLabel(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function edgePath(a: Positioned, b: Positioned, id: string, curvature: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const direction = hashFor(id) % 2 === 0 ? 1 : -1;
  const offset = curvature * length * direction;
  const controlX = (a.x + b.x) / 2 - (dy / length) * offset;
  const controlY = (a.y + b.y) / 2 + (dx / length) * offset;
  return `M ${a.x} ${a.y} Q ${controlX} ${controlY} ${b.x} ${b.y}`;
}

function storageKey(actorId: string) {
  return `understory:graph-layout:${actorId}`;
}

function loadOffsets(actorId: string): Record<string, Offset> {
  try {
    const raw = window.localStorage.getItem(storageKey(actorId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const result: Record<string, Offset> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const offset = value as Partial<Offset>;
      if (typeof offset.dx !== 'number' || typeof offset.dy !== 'number') continue;
      if (!Number.isFinite(offset.dx) || !Number.isFinite(offset.dy)) continue;
      result[id] = {
        dx: clamp(offset.dx, -1200, 1200),
        dy: clamp(offset.dy, -1200, 1200),
      };
    }
    return result;
  } catch {
    return {};
  }
}

export function NetworkGraphView({
  graph,
  theme,
  actorId,
  onSelect,
  showDensity,
}: {
  graph: GraphModel;
  theme: ThemeId;
  actorId: string;
  onSelect: (node: GraphNode) => void;
  showDensity: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const base = useMemo(() => layoutGraph(graph), [graph]);
  const [offsets, setOffsets] = useState<Record<string, Offset>>(() => loadOffsets(actorId));
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<'idle' | 'node' | 'pan'>('idle');
  const movedRef = useRef(false);
  const dragRef = useRef<{ id: string; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  useEffect(() => {
    setOffsets(loadOffsets(actorId));
    setCamera(DEFAULT_CAMERA);
    setLastSelected(null);
  }, [actorId]);

  useEffect(() => {
    try {
      if (Object.keys(offsets).length === 0) {
        window.localStorage.removeItem(storageKey(actorId));
      } else {
        window.localStorage.setItem(storageKey(actorId), JSON.stringify(offsets));
      }
    } catch {
      // Storage can be unavailable; the layout still works for this session.
    }
  }, [actorId, offsets]);

  const positions = useMemo(() => {
    const result: Record<string, Positioned> = {};
    for (const [id, node] of Object.entries(base)) {
      const offset = offsets[id];
      result[id] = {
        ...node,
        x: clamp(node.x + (offset?.dx ?? 0), 38, WIDTH - 38),
        y: clamp(node.y + (offset?.dy ?? 0), 34, HEIGHT - 34),
      };
    }
    return result;
  }, [base, offsets]);

  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const connected = useMemo(() => {
    if (!hovered) return null;
    const ids = new Set<string>([hovered]);
    for (const edge of graph.edges) {
      if (edge.source === hovered) ids.add(edge.target);
      if (edge.target === hovered) ids.add(edge.source);
    }
    return ids;
  }, [hovered, graph.edges]);

  const hoveredNode = hovered ? graph.nodes.find((node) => node.id === hovered) : undefined;
  const hoveredEdgeData = hoveredEdge ? graph.edges.find((edge) => edge.id === hoveredEdge) : undefined;

  const curvature = theme === 'web' ? 0 : theme === 'tree' ? 0.06 : 0.11;

  const zoomAt = (nextK: number, px = 0.5, py = 0.5) => {
    setCamera((current) => {
      const k = clamp(nextK, MIN_ZOOM, MAX_ZOOM);
      const worldX = current.x + px * (WIDTH / current.k);
      const worldY = current.y + py * (HEIGHT / current.k);
      return {
        k,
        x: clamp(worldX - px * (WIDTH / k), -420, WIDTH - WIDTH / k + 420),
        y: clamp(worldY - py * (HEIGHT / k), -320, HEIGHT - HEIGHT / k + 320),
      };
    });
  };

  const zoomBy = (factor: number) => zoomAt(cameraRef.current.k * factor);

  const fitView = () => {
    const list = Object.values(positionsRef.current);
    if (list.length === 0) {
      setCamera(DEFAULT_CAMERA);
      return;
    }
    const minX = Math.min(...list.map((n) => n.x)) - 80;
    const maxX = Math.max(...list.map((n) => n.x)) + 80;
    const minY = Math.min(...list.map((n) => n.y)) - 70;
    const maxY = Math.max(...list.map((n) => n.y)) + 70;
    const k = clamp(Math.min(WIDTH / (maxX - minX), HEIGHT / (maxY - minY)), MIN_ZOOM, 1.8);
    setCamera({
      k,
      x: (minX + maxX) / 2 - WIDTH / (2 * k),
      y: (minY + maxY) / 2 - HEIGHT / (2 * k),
    });
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
      const py = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
      zoomAt(cameraRef.current.k * Math.exp(-event.deltaY * 0.0016), px, py);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scaleFactor = () => {
    const svg = svgRef.current;
    if (!svg) return 1;
    const rect = svg.getBoundingClientRect();
    return (rect.width / WIDTH) * cameraRef.current.k;
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const target = (event.target as Element).closest('[data-node-id]');
    const nodeId = target?.getAttribute('data-node-id') ?? null;
    movedRef.current = false;
    if (nodeId) {
      const node = positionsRef.current[nodeId];
      if (!node) return;
      dragRef.current = {
        id: nodeId,
        startX: event.clientX,
        startY: event.clientY,
        baseX: node.x,
        baseY: node.y,
      };
      setInteraction('node');
    } else {
      const current = cameraRef.current;
      panRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        camX: current.x,
        camY: current.y,
      };
      setInteraction('pan');
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (drag) {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.hypot(dx, dy) > 3) movedRef.current = true;
      const factor = scaleFactor() || 1;
      const node = base[drag.id];
      if (!node) return;
      const x = clamp(drag.baseX + dx / factor, 38, WIDTH - 38);
      const y = clamp(drag.baseY + dy / factor, 34, HEIGHT - 34);
      setOffsets((current) => ({
        ...current,
        [drag.id]: { dx: x - node.x, dy: y - node.y },
      }));
      return;
    }
    const pan = panRef.current;
    if (pan) {
      const dx = event.clientX - pan.startX;
      const dy = event.clientY - pan.startY;
      if (Math.hypot(dx, dy) > 2) movedRef.current = true;
      const factor = scaleFactor() || 1;
      setCamera((current) => ({
        ...current,
        x: clamp(pan.camX - dx / factor, -420, WIDTH - WIDTH / current.k + 420),
        y: clamp(pan.camY - dy / factor, -320, HEIGHT - HEIGHT / current.k + 320),
      }));
    }
  };

  const endPointer = () => {
    const drag = dragRef.current;
    if (drag && !movedRef.current) {
      const node = graph.nodes.find((item) => item.id === drag.id);
      if (node) {
        setLastSelected(node.id);
        onSelect(node);
      }
    }
    dragRef.current = null;
    panRef.current = null;
    setInteraction('idle');
  };

  const fittedRef = useRef(false);
  useEffect(() => {
    fittedRef.current = false;
  }, [actorId]);
  useEffect(() => {
    if (fittedRef.current || Object.keys(positions).length === 0) return;
    const timer = window.setTimeout(() => {
      fittedRef.current = true;
      fitView();
    }, 40);
    return () => window.clearTimeout(timer);
    // Fit once when the map opens; later filter changes keep the current view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  const hasCustomLayout = Object.keys(offsets).length > 0;

  return (
    <figure className="network-graph-figure">
      <div className="graph-shell">
        <svg
          ref={svgRef}
          className={`network-graph theme-${theme}${interaction !== 'idle' ? ` is-${interaction}` : ''}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="group"
          aria-label={`Interactive network map with ${graph.nodes.length} nodes and ${graph.edges.length} visible connections. Drag the background to move around, drag a node to rearrange it, scroll to zoom. Focus a node and use Alt with the arrow keys to nudge it.`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onPointerLeave={(event) => {
            if (interaction === 'idle') return;
            if (event.buttons === 0) endPointer();
          }}
        >
          <defs>
            <radialGradient id="graph-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--graph-halo)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--graph-halo)" stopOpacity="0" />
            </radialGradient>
            <pattern id="graph-grid" width="26" height="26" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" className="graph-grid-dot" />
            </pattern>
          </defs>

          <g transform={`translate(${-camera.x * camera.k}, ${-camera.y * camera.k}) scale(${camera.k})`}>
            <rect
              x={-600}
              y={-500}
              width={WIDTH + 1200}
              height={HEIGHT + 1000}
              fill="url(#graph-grid)"
              className="graph-grid"
            />

            {showDensity
              ? graph.clusters.map((cluster) => {
                  const hub = positions[cluster.communityId];
                  if (!hub) return null;
                  const members = cluster.nodeIds
                    .map((id) => positions[id])
                    .filter((p): p is Positioned => Boolean(p));
                  const radius =
                    Math.max(...members.map((m) => Math.hypot(m.x - hub.x, m.y - hub.y)), 50) + 60;
                  return (
                    <g key={`halo-${cluster.communityId}`} pointerEvents="none">
                      <circle
                        cx={hub.x}
                        cy={hub.y}
                        r={radius}
                        fill="url(#graph-glow)"
                        className="density-halo"
                      />
                      <circle
                        cx={hub.x}
                        cy={hub.y}
                        r={radius}
                        className="density-halo-ring"
                      />
                    </g>
                  );
                })
              : null}

            <g className="graph-edges">
              {graph.edges.map((edge) => {
                const a = positions[edge.source];
                const b = positions[edge.target];
                if (!a || !b) return null;
                const active = !connected || (connected.has(edge.source) && connected.has(edge.target));
                const d = edgePath(a, b, edge.id, curvature);
                return (
                  <g key={edge.id} className={`graph-edge-group${active ? ' is-active' : ''}`}>
                    <path
                      d={d}
                      className="graph-edge-hit"
                      onMouseEnter={() => setHoveredEdge(edge.id)}
                      onMouseLeave={() => setHoveredEdge(null)}
                    />
                    <path
                      d={d}
                      className={`graph-edge edge-${edge.type}${active ? ' is-active' : ''}${
                        hoveredEdge === edge.id ? ' is-hovered' : ''
                      }`}
                    />
                  </g>
                );
              })}
            </g>

            <g className="graph-nodes">
              {Object.values(positions).map((node) => {
                const radius = nodeRadius(node);
                const dimmed = connected ? !connected.has(node.id) : false;
                const showLabel =
                  node.type === 'self' ||
                  node.type === 'community' ||
                  hovered === node.id ||
                  lastSelected === node.id ||
                  Boolean(connected?.has(node.id));
                return (
                  <g
                    key={node.id}
                    data-node-id={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className={`graph-node node-${node.type}${dimmed ? ' is-dimmed' : ''}${
                      hovered === node.id ? ' is-hovered' : ''
                    }${lastSelected === node.id ? ' is-selected' : ''}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${node.label}. ${node.type}. ${node.detail ?? ''}. Drag to rearrange, press Enter to inspect.`}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(node.id)}
                    onBlur={() => setHovered(null)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setLastSelected(node.id);
                        onSelect(node);
                        return;
                      }
                      const step = event.shiftKey ? 4 : 14;
                      const moves: Record<string, [number, number]> = {
                        ArrowLeft: [-step, 0],
                        ArrowRight: [step, 0],
                        ArrowUp: [0, -step],
                        ArrowDown: [0, step],
                      };
                      const move = moves[event.key];
                      if (!move || !event.altKey) return;
                      event.preventDefault();
                      const anchor = base[node.id];
                      if (!anchor) return;
                      const x = clamp(node.x + move[0], 38, WIDTH - 38);
                      const y = clamp(node.y + move[1], 34, HEIGHT - 34);
                      setOffsets((current) => ({
                        ...current,
                        [node.id]: { dx: x - anchor.x, dy: y - anchor.y },
                      }));
                    }}
                  >
                    <circle r={radius + 13} className="node-touch-target" />
                    {node.type === 'project' ? (
                      <rect
                        x={-radius + 3}
                        y={-radius + 3}
                        width={(radius - 3) * 2}
                        height={(radius - 3) * 2}
                        rx={theme === 'mycelium' ? 8 : 3}
                        className="node-shape"
                        transform="rotate(45)"
                      />
                    ) : (
                      <circle r={radius} className="node-shape" />
                    )}
                    {node.type === 'community' ? (
                      <>
                        <circle r={radius + 5} className="node-ring" />
                        <circle r={radius + 10} className="node-ring-outer" />
                      </>
                    ) : null}
                    {node.type === 'self' ? <circle r={5} className="node-core" /> : null}
                    {node.type === 'person' ? (
                      <text className="node-initial" textAnchor="middle" dy="4">
                        {node.label
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join('')}
                      </text>
                    ) : null}
                    {node.type === 'community' ? (
                      <text className="node-initial" textAnchor="middle" dy="4">
                        {node.label
                          .split(/\s+/)
                          .slice(0, 1)
                          .map((part) => part[0])
                          .join('')}
                      </text>
                    ) : null}
                    {showLabel ? (
                      <text
                        className="node-label"
                        textAnchor="middle"
                        y={radius + 17}
                        aria-hidden="true"
                      >
                        {shortLabel(node.label, node.type === 'community' ? 27 : 22)}
                      </text>
                    ) : null}
                    <title>
                      {node.label} — {node.detail ?? ''}
                    </title>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        <div className="graph-readout" aria-live="polite">
          {hoveredEdgeData ? (
            <>
              <strong>{edgeLabel(hoveredEdgeData.type)}</strong>
              <span>{hoveredEdgeData.label}</span>
              <small>{edgeExplanation(hoveredEdgeData.type)}</small>
            </>
          ) : hoveredNode ? (
            <>
              <strong>{hoveredNode.label}</strong>
              <span>{hoveredNode.detail ?? hoveredNode.type}</span>
              <small>Click to inspect · drag to rearrange</small>
            </>
          ) : (
            <>
              <strong>Move around the map</strong>
              <span>Drag the ground to pan · scroll to zoom · drag a node to reposition it</span>
              <small>Click a node to inspect it. On touch, use the map controls.</small>
            </>
          )}
        </div>

        <div className="graph-controls" role="group" aria-label="Map controls">
          <button
            type="button"
            className="graph-control"
            onClick={() => zoomBy(1.25)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <span className="graph-zoom">
            <span className="sr-only">Zoom </span>
            {Math.round(camera.k * 100)}
            <span aria-hidden="true">%</span>
            <span className="sr-only"> percent</span>
          </span>
          <button
            type="button"
            className="graph-control"
            onClick={() => zoomBy(0.8)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <button type="button" className="graph-control graph-control-word" onClick={fitView}>
            Fit
          </button>
          <button
            type="button"
            className="graph-control graph-control-word"
            onClick={() => setCamera(DEFAULT_CAMERA)}
          >
            Recentre
          </button>
          <button
            type="button"
            className="graph-control graph-control-word"
            onClick={() => setOffsets({})}
            disabled={!hasCustomLayout}
            title="Return every node to its automatic position"
          >
            Reset layout
          </button>
        </div>
      </div>
      <figcaption className="graph-caption">
        <Icon name="info" size={14} />
        <span>
          Map position is layout, not trust. Node placement is yours to change and is stored on this
          node only; it never changes consent, sharing or membership. Other people’s bilateral
          connections are not shown.
        </span>
      </figcaption>
    </figure>
  );
}

export function NetworkLegend({ graph }: { graph: GraphModel }) {
  const counts = new Map<string, number>();
  for (const edge of graph.edges) counts.set(edge.type, (counts.get(edge.type) ?? 0) + 1);
  const order: (keyof typeof explanations)[] = [
    'relationship-active',
    'relationship-pending',
    'relationship-declined',
    'membership',
    'agreement-active',
    'agreement-proposed',
    'project',
  ];
  return (
    <div className="network-legend" role="group" aria-label="Graph legend">
      {order.map((type) => (
        <div className="legend-item" key={type}>
          <span className={`legend-line legend-${type}`} aria-hidden="true" />
          <span>{edgeLabel(type)}</span>
          <span className="legend-count">{counts.get(type) ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

const explanations = {
  'relationship-active': edgeExplanation('relationship-active'),
  'relationship-pending': edgeExplanation('relationship-pending'),
  'relationship-declined': edgeExplanation('relationship-declined'),
  membership: edgeExplanation('membership'),
  'agreement-active': edgeExplanation('agreement-active'),
  'agreement-proposed': edgeExplanation('agreement-proposed'),
  project: edgeExplanation('project'),
} as const;
