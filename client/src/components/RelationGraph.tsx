import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

type GraphSubject = {
  id: number;
  uid: string | null;
  type: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
};

type EnrichedEntityLink = {
  id: number;
  sourceId: number;
  targetId: number;
  relationType: string;
  label: string | null;
  validFrom: string | null;
  validTo: string | null;
  isArchived: boolean;
  source: GraphSubject | null;
  target: GraphSubject | null;
};

type NodeData = {
  id: number;
  label: string;
  type: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type EdgeData = {
  id: number;
  sourceId: number;
  targetId: number;
  relationType: string;
  label: string | null;
  isArchived: boolean;
};

function getSubjectLabel(s: GraphSubject | null): string {
  if (!s) return "?";
  if (s.type === "company" || s.type === "mycompany" || s.type === "partner") return s.companyName || "—";
  return `${s.firstName || ""} ${s.lastName || ""}`.trim() || s.companyName || "—";
}

function getNodeColor(type: string | null): string {
  switch (type) {
    case "person": return "#3B5BDB";
    case "szco": return "#F59E0B";
    case "company":
    case "mycompany": return "#10B981";
    case "partner": return "#06B6D4";
    case "os":
    case "church": return "#8B5CF6";
    case "holding": return "#6366F1";
    case "state":
    case "institution":
    case "system": return "#64748B";
    case "ts": return "#14B8A6";
    case "vs": return "#F97316";
    default: return "#8B5CF6";
  }
}

function getRelationLabel(relationType: string): string {
  switch (relationType) {
    case "digital_portal_for": return "Digitálny portál";
    case "official_owner": return "Vlastník";
    case "sponsor_guardian": return "Sponzor/Opatrovník";
    case "beneficiary_owner": return "Konečný vlastník";
    case "parent_child": return "Rodič/Dieťa";
    case "employer_employee": return "Zamestnávateľ/Zamestnanec";
    case "shareholder": return "Akcionár";
    case "statutory_officer": return "Štatutár";
    case "contract_manager": return "Správca zmluvy";
    case "referrer_primary": return "Primárny odporúčateľ";
    case "referrer_stack": return "Reťazec odporúčateľov";
    case "responsible_specialist": return "Zodpovedný špecialista";
    case "referral_source": return "Zdroj odporúčania";
    case "custom": return "Vlastný";
    default: return relationType;
  }
}

interface RelationGraphProps {
  links: EnrichedEntityLink[];
  onNodeClick: (subjectId: number) => void;
  selectedNodeId: number | null;
}

export function RelationGraph({ links, onNodeClick, selectedNodeId }: RelationGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ nodeId: number; ox: number; oy: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const animRef = useRef<number | null>(null);
  const nodesRef = useRef<NodeData[]>([]);
  const WIDTH = 800;
  const HEIGHT = 500;

  const buildGraph = useCallback(() => {
    const nodeMap = new Map<number, NodeData>();
    links.forEach(link => {
      if (link.source && !nodeMap.has(link.source.id)) {
        nodeMap.set(link.source.id, {
          id: link.source.id,
          label: getSubjectLabel(link.source),
          type: link.source.type,
          x: WIDTH / 2 + (Math.random() - 0.5) * 300,
          y: HEIGHT / 2 + (Math.random() - 0.5) * 200,
          vx: 0,
          vy: 0,
        });
      }
      if (link.target && !nodeMap.has(link.target.id)) {
        nodeMap.set(link.target.id, {
          id: link.target.id,
          label: getSubjectLabel(link.target),
          type: link.target.type,
          x: WIDTH / 2 + (Math.random() - 0.5) * 300,
          y: HEIGHT / 2 + (Math.random() - 0.5) * 200,
          vx: 0,
          vy: 0,
        });
      }
    });

    const newEdges: EdgeData[] = links.map(link => ({
      id: link.id,
      sourceId: link.sourceId,
      targetId: link.targetId,
      relationType: link.relationType,
      label: link.label,
      isArchived: link.isArchived,
    }));

    const newNodes = Array.from(nodeMap.values());
    nodesRef.current = newNodes;
    setNodes([...newNodes]);
    setEdges(newEdges);
  }, [links]);

  useEffect(() => {
    buildGraph();
  }, [buildGraph]);

  useEffect(() => {
    let running = true;
    const REPULSION = 3000;
    const SPRING = 0.04;
    const IDEAL_LEN = 180;
    const DAMPING = 0.7;
    const CENTER_GRAVITY = 0.005;

    function tick() {
      if (!running) return;
      const ns = nodesRef.current;
      if (ns.length === 0) { animRef.current = requestAnimationFrame(tick); return; }

      const edgeSnap = edges;
      const cx = WIDTH / 2;
      const cy = HEIGHT / 2;

      for (let i = 0; i < ns.length; i++) {
        let fx = (cx - ns[i].x) * CENTER_GRAVITY;
        let fy = (cy - ns[i].y) * CENTER_GRAVITY;

        for (let j = 0; j < ns.length; j++) {
          if (i === j) continue;
          const dx = ns[i].x - ns[j].x;
          const dy = ns[i].y - ns[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }

        for (const e of edgeSnap) {
          let otherId: number | null = null;
          if (e.sourceId === ns[i].id) otherId = e.targetId;
          else if (e.targetId === ns[i].id) otherId = e.sourceId;
          if (otherId === null) continue;
          const other = ns.find(n => n.id === otherId);
          if (!other) continue;
          const dx = other.x - ns[i].x;
          const dy = other.y - ns[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const stretch = dist - IDEAL_LEN;
          fx += (dx / dist) * stretch * SPRING;
          fy += (dy / dist) * stretch * SPRING;
        }

        ns[i].vx = (ns[i].vx + fx) * DAMPING;
        ns[i].vy = (ns[i].vy + fy) * DAMPING;
        ns[i].x += ns[i].vx;
        ns[i].y += ns[i].vy;

        ns[i].x = Math.max(60, Math.min(WIDTH - 60, ns[i].x));
        ns[i].y = Math.max(40, Math.min(HEIGHT - 40, ns[i].y));
      }

      setNodes([...ns]);
      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [edges]);

  const nodeMap = useMemo(() => {
    const m = new Map<number, NodeData>();
    nodes.forEach(n => m.set(n.id, n));
    return m;
  }, [nodes]);

  const handleSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).closest("[data-node]")) return;
    setPanning({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
  }, [pan]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging) {
      const rect = svgRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      const ns = nodesRef.current;
      const node = ns.find(n => n.id === dragging.nodeId);
      if (node) {
        node.x = x;
        node.y = y;
        node.vx = 0;
        node.vy = 0;
        setNodes([...ns]);
      }
    } else if (panning) {
      setPan({
        x: panning.panX + (e.clientX - panning.startX),
        y: panning.panY + (e.clientY - panning.startY),
      });
    }
  }, [dragging, panning, pan, zoom]);

  const handleSvgMouseUp = useCallback(() => {
    setDragging(null);
    setPanning(null);
  }, []);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: number) => {
    e.stopPropagation();
    setDragging({ nodeId, ox: e.clientX, oy: e.clientY });
  }, []);

  const handleNodeClick = useCallback((e: React.MouseEvent, nodeId: number) => {
    e.stopPropagation();
    onNodeClick(nodeId);
  }, [onNodeClick]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  return (
    <div className="relative w-full border border-border rounded-md overflow-hidden bg-background" style={{ height: 500 }}>
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.min(3, z + 0.2))} data-testid="btn-zoom-in">
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} data-testid="btn-zoom-out">
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} data-testid="btn-zoom-reset">
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {nodes.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Žiadne prepojenia na zobrazenie
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleSvgMouseMove}
        onMouseUp={handleSvgMouseUp}
        onMouseLeave={handleSvgMouseUp}
        onWheel={handleWheel}
        style={{ cursor: panning ? "grabbing" : "grab", userSelect: "none" }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
          </marker>
          <marker id="arrowhead-archived" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#475569" />
          </marker>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {edges.map(edge => {
            const src = nodeMap.get(edge.sourceId);
            const tgt = nodeMap.get(edge.targetId);
            if (!src || !tgt) return null;
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const NODE_R = 28;
            const ex = tgt.x - (dx / dist) * (NODE_R + 8);
            const ey = tgt.y - (dy / dist) * (NODE_R + 8);
            const sx = src.x + (dx / dist) * NODE_R;
            const sy = src.y + (dy / dist) * NODE_R;
            const mx = (sx + ex) / 2;
            const my = (sy + ey) / 2;
            const archived = edge.isArchived;
            return (
              <g key={edge.id}>
                <line
                  x1={sx} y1={sy} x2={ex} y2={ey}
                  stroke={archived ? "#475569" : "#94a3b8"}
                  strokeWidth={1.5}
                  strokeDasharray={archived ? "5,4" : undefined}
                  markerEnd={archived ? "url(#arrowhead-archived)" : "url(#arrowhead)"}
                />
                <text
                  x={mx} y={my - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fill={archived ? "#475569" : "#64748b"}
                  style={{ pointerEvents: "none" }}
                >
                  {getRelationLabel(edge.relationType)}
                </text>
                {edge.label && (
                  <text
                    x={mx} y={my + 5}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#475569"
                    style={{ pointerEvents: "none" }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {nodes.map(node => {
            const color = getNodeColor(node.type);
            const isSelected = node.id === selectedNodeId;
            return (
              <g
                key={node.id}
                data-node="true"
                onMouseDown={e => handleNodeMouseDown(e, node.id)}
                onClick={e => handleNodeClick(e, node.id)}
                style={{ cursor: "pointer" }}
                data-testid={`graph-node-${node.id}`}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={28}
                  fill={color}
                  fillOpacity={0.15}
                  stroke={color}
                  strokeWidth={isSelected ? 3 : 1.5}
                />
                <text
                  x={node.x}
                  y={node.y - 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="10"
                  fontWeight="500"
                  fill={color}
                  style={{ pointerEvents: "none" }}
                >
                  {node.label.length > 14 ? node.label.slice(0, 13) + "…" : node.label}
                </text>
                {node.type && (
                  <text
                    x={node.x}
                    y={node.y + 12}
                    textAnchor="middle"
                    fontSize="8"
                    fill={color}
                    fillOpacity={0.7}
                    style={{ pointerEvents: "none" }}
                  >
                    {node.type.toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
        {[
          { type: "person", label: "FO" },
          { type: "szco", label: "SZČO" },
          { type: "company", label: "PO/s.r.o." },
          { type: "os", label: "OS/Cirkev" },
          { type: "holding", label: "Holding" },
          { type: "system", label: "Štát/Inšt." },
        ].map(({ type, label }) => (
          <div key={type} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: getNodeColor(type) + "33", borderColor: getNodeColor(type) }} />
            <span className="text-[9px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
