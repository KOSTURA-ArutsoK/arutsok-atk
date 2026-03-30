import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { StatusChangeModal } from "@/components/status-change-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ContractStatus } from "@shared/schema";

const OCTAGON_PATH = "M 101,20 L 130,49 L 130,91 L 101,120 L 59,120 L 30,91 L 30,49 L 59,20 Z";

interface ContractResult {
  id: number;
  contractNumber: string | null;
  proposalNumber: string | null;
  statusId: number | null;
}

export default function PridatStavZmluvy() {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContract, setSelectedContract] = useState<ContractResult | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  const isActive = hovered || pressed;

  const { data: statuses } = useQuery<ContractStatus[]>({
    queryKey: ["/api/contract-statuses"],
  });

  const { data: searchResults, isLoading: searching } = useQuery<ContractResult[]>({
    queryKey: ["/api/contracts/search-by-number", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
      const res = await fetch(
        `/api/contracts?limit=20&fields=id,contractNumber,proposalNumber,statusId`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      const all: any[] = await res.json();
      const q = searchQuery.trim().toLowerCase();
      return all.filter(c =>
        (c.contractNumber || "").toLowerCase().includes(q) ||
        (c.proposalNumber || "").toLowerCase().includes(q)
      ).slice(0, 15);
    },
    enabled: searchQuery.trim().length >= 2,
  });

  function handleButtonClick() {
    setSearchQuery("");
    setSelectedContract(null);
    setSearchOpen(true);
  }

  function handleSelectContract(c: ContractResult) {
    setSelectedContract(c);
    setSearchOpen(false);
    setStatusModalOpen(true);
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh]"
      data-testid="page-pridat-stav-zmluvy"
    >
      <button
        type="button"
        data-testid="button-pridat-stav-zmluvy"
        onClick={handleButtonClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        style={{
          position: "relative",
          width: 222,
          height: 254,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          outline: "none",
          userSelect: "none",
          transition: "transform 0.15s ease",
          transform: pressed ? "scale(0.96)" : hovered ? "scale(1.05)" : "scale(1)",
        }}
      >
        <svg
          width="222"
          height="194"
          viewBox="0 0 160 140"
          fill="none"
          style={{ position: "absolute", top: 10, left: 0, overflow: "visible" }}
        >
          <defs>
            <filter id="stavGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="16" result="blur" />
            </filter>
            <linearGradient id="octGradStav" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a1f3d" />
              <stop offset="100%" stopColor="#1a3f80" />
            </linearGradient>
          </defs>
          <path
            d={OCTAGON_PATH}
            fill={isActive ? "rgba(57,255,20,1.0)" : "rgba(56,189,248,0.50)"}
            filter="url(#stavGlow)"
            style={{ transition: "fill 0.2s ease" }}
          />
          <path
            d={OCTAGON_PATH}
            fill="url(#octGradStav)"
            stroke={isActive ? "rgba(245,158,11,0.70)" : "rgba(245,158,11,0.35)"}
            strokeWidth="2"
            style={{ transition: "stroke 0.15s ease" }}
          />
        </svg>

        <div style={{
          position: "absolute",
          top: 38, left: 0, right: 0,
          height: 139,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
        }}>
          <div style={{ position: "relative", display: "inline-flex" }}>
            <span style={{
              fontSize: 38,
              lineHeight: 1,
              position: "relative",
              top: -6,
              filter: `sepia(1) saturate(8) hue-rotate(180deg) brightness(1.2) drop-shadow(0 0 8px rgba(0,191,255,${isActive ? 0.95 : 0.55}))`,
              transition: "filter 0.15s ease",
              display: "block",
            }}>🏷️</span>
            <Plus
              size={14}
              strokeWidth={2.5}
              style={{
                position: "absolute",
                top: -6,
                right: -9,
                color: "#FFBF00",
                filter: "drop-shadow(0 0 5px #FFBF00)",
              }}
            />
          </div>
          <span style={{
            fontFamily: "sans-serif",
            fontSize: 11,
            fontWeight: 800,
            color: "#b8d0f0",
            letterSpacing: "0.04em",
            textAlign: "center",
            lineHeight: 1.2,
            display: "block",
            width: "100%",
          }}>
            Pridať stav
          </span>
        </div>
      </button>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-hladat-zmluvu">
          <DialogHeader>
            <DialogTitle>Vyhľadať zmluvu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              data-testid="input-search-contract"
              placeholder="Číslo zmluvy alebo návrhu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {searchQuery.trim().length < 2 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Zadajte aspoň 2 znaky
                </p>
              )}
              {searching && (
                <p className="text-sm text-muted-foreground text-center py-4">Hľadám...</p>
              )}
              {!searching && searchQuery.trim().length >= 2 && searchResults?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Žiadne výsledky</p>
              )}
              {(searchResults || []).map(c => (
                <Button
                  key={c.id}
                  variant="ghost"
                  className="w-full justify-start text-left h-auto py-2"
                  data-testid={`item-contract-${c.id}`}
                  onClick={() => handleSelectContract(c)}
                >
                  <div>
                    <div className="font-medium text-sm">
                      {c.contractNumber || c.proposalNumber || `Zmluva #${c.id}`}
                    </div>
                    {c.contractNumber && c.proposalNumber && (
                      <div className="text-xs text-muted-foreground">Návrh: {c.proposalNumber}</div>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedContract && (
        <StatusChangeModal
          open={statusModalOpen}
          onOpenChange={open => {
            setStatusModalOpen(open);
            if (!open) setSelectedContract(null);
          }}
          contractId={selectedContract.id}
          currentStatusId={selectedContract.statusId}
          statuses={statuses || []}
        />
      )}
    </div>
  );
}
