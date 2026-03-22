import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Phone, Mail, MessageSquare, Globe, Star, Plus, Pencil, Trash2, X, Check, Loader2,
} from "lucide-react";
import type { SubjectContact } from "@shared/schema";

const CONTACT_TYPES: { value: string; label: string; icon: typeof Phone }[] = [
  { value: "phone", label: "Telefón", icon: Phone },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "website", label: "Web", icon: Globe },
];

function ContactTypeIcon({ type, className }: { type: string; className?: string }) {
  const found = CONTACT_TYPES.find(t => t.value === type);
  const Icon = found?.icon || Phone;
  return <Icon className={cn("w-3.5 h-3.5", className)} />;
}

function groupByType(contacts: SubjectContact[]): Record<string, SubjectContact[]> {
  const groups: Record<string, SubjectContact[]> = {};
  for (const c of contacts) {
    if (!groups[c.type]) groups[c.type] = [];
    groups[c.type].push(c);
  }
  return groups;
}

interface SubjectContactsPanelProps {
  subjectId: number;
  readonly?: boolean;
}

export function SubjectContactsPanel({ subjectId, readonly = false }: SubjectContactsPanelProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addingType, setAddingType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [newType, setNewType] = useState("phone");
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const { data: contacts = [], isLoading } = useQuery<SubjectContact[]>({
    queryKey: ["/api/subjects", subjectId, "contacts"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/contacts`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: subjectId > 0,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { type: string; value: string; label?: string; isPrimary?: boolean }) => {
      const res = await apiRequest("POST", `/api/subjects/${subjectId}/contacts`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      setAddingType(null);
      setNewValue("");
      setNewLabel("");
      toast({ title: "Kontakt pridaný" });
    },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/subjects/${subjectId}/contacts/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      setEditingId(null);
      toast({ title: "Kontakt aktualizovaný" });
    },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/subjects/${subjectId}/contacts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      toast({ title: "Kontakt odstránený" });
    },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  const grouped = groupByType(contacts);
  const typeOrder = ["phone", "email", "whatsapp", "website"];
  const presentTypes = typeOrder.filter(t => (grouped[t]?.length ?? 0) > 0);

  if (isLoading) {
    return <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />Načítavam kontakty…</div>;
  }

  return (
    <div className="space-y-0" data-testid="subject-contacts-panel">
      {presentTypes.length === 0 && !addingType && (
        <p className="text-xs text-muted-foreground py-2 text-center">Žiadne kontakty</p>
      )}

      {presentTypes.map((type, typeIdx) => {
        const typeContacts = grouped[type] || [];
        const typeMeta = CONTACT_TYPES.find(t => t.value === type);
        return (
          <div key={type}>
            {typeIdx > 0 && <Separator className="my-1" />}
            <div className="space-y-0">
              {typeContacts.map((contact, idx) => (
                <div key={contact.id}>
                  {idx > 0 && <div className="border-t border-border/30 mx-1" />}
                  {editingId === contact.id ? (
                    <div className="flex items-center gap-1.5 py-1.5 px-1" data-testid={`contact-edit-${contact.id}`}>
                      <ContactTypeIcon type={contact.type} className="text-muted-foreground flex-shrink-0" />
                      <Input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="h-7 text-xs flex-1"
                        placeholder="Hodnota"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter") updateMutation.mutate({ id: contact.id, updates: { value: editValue, label: editLabel } });
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        data-testid={`input-contact-value-${contact.id}`}
                      />
                      <Input
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        className="h-7 text-xs w-24"
                        placeholder="Popis"
                        onKeyDown={e => {
                          if (e.key === "Enter") updateMutation.mutate({ id: contact.id, updates: { value: editValue, label: editLabel } });
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        data-testid={`input-contact-label-${contact.id}`}
                      />
                      <button
                        onClick={() => updateMutation.mutate({ id: contact.id, updates: { value: editValue, label: editLabel } })}
                        disabled={updateMutation.isPending}
                        className="text-green-500 hover:text-green-600 p-0.5"
                        data-testid={`btn-contact-save-${contact.id}`}
                      >
                        {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        data-testid={`btn-contact-cancel-${contact.id}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between gap-1 py-1 px-1 group rounded hover:bg-muted/30 transition-colors"
                      data-testid={`contact-row-${contact.id}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <ContactTypeIcon type={contact.type} className="text-muted-foreground flex-shrink-0" />
                        <span className="text-xs font-mono truncate" data-testid={`contact-value-${contact.id}`}>{contact.value}</span>
                        {contact.label && (
                          <span className="text-[10px] text-muted-foreground truncate">({contact.label})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {!contact.isPrimary && (
                          <button
                            onClick={() => updateMutation.mutate({ id: contact.id, updates: { isPrimary: true } })}
                            className="text-amber-400/50 hover:text-amber-400 p-0.5"
                            title="Nastaviť ako primárny"
                            data-testid={`btn-set-primary-${contact.id}`}
                          >
                            <Star className="w-3 h-3" />
                          </button>
                        )}
                        {!readonly && (
                          <>
                            <button
                              onClick={() => { setEditingId(contact.id); setEditValue(contact.value); setEditLabel(contact.label || ""); }}
                              className="text-muted-foreground hover:text-foreground p-0.5"
                              data-testid={`btn-edit-contact-${contact.id}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => { if (confirm("Odstrániť kontakt?")) deleteMutation.mutate(contact.id); }}
                              className="text-muted-foreground hover:text-destructive p-0.5"
                              data-testid={`btn-delete-contact-${contact.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        {contact.isPrimary && (
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" title="Primárny kontakt" data-testid={`star-primary-${contact.id}`} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {addingType && (
        <div className="border-t border-border/40 pt-2 mt-1">
          <div className="flex items-start gap-1.5 flex-wrap" data-testid="contact-add-form">
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="h-7 text-xs w-28" data-testid="select-contact-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              className="h-7 text-xs flex-1 min-w-[120px]"
              placeholder="Hodnota"
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter" && newValue.trim()) {
                  createMutation.mutate({ type: newType, value: newValue.trim(), label: newLabel.trim() || undefined, isPrimary: contacts.filter(c => c.type === newType).length === 0 });
                }
                if (e.key === "Escape") { setAddingType(null); setNewValue(""); setNewLabel(""); }
              }}
              data-testid="input-new-contact-value"
            />
            <Input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="h-7 text-xs w-24"
              placeholder="Popis"
              onKeyDown={e => {
                if (e.key === "Enter" && newValue.trim()) {
                  createMutation.mutate({ type: newType, value: newValue.trim(), label: newLabel.trim() || undefined, isPrimary: contacts.filter(c => c.type === newType).length === 0 });
                }
                if (e.key === "Escape") { setAddingType(null); setNewValue(""); setNewLabel(""); }
              }}
              data-testid="input-new-contact-label"
            />
            <button
              onClick={() => {
                if (newValue.trim()) createMutation.mutate({ type: newType, value: newValue.trim(), label: newLabel.trim() || undefined, isPrimary: contacts.filter(c => c.type === newType).length === 0 });
              }}
              disabled={createMutation.isPending || !newValue.trim()}
              className="h-7 px-2 rounded bg-primary/90 hover:bg-primary text-primary-foreground text-xs flex items-center gap-1 disabled:opacity-50"
              data-testid="btn-save-new-contact"
            >
              {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Uložiť
            </button>
            <button
              onClick={() => { setAddingType(null); setNewValue(""); setNewLabel(""); }}
              className="h-7 px-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground"
              data-testid="btn-cancel-new-contact"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {!readonly && !addingType && (
        <div className="pt-1">
          <button
            onClick={() => { setAddingType("phone"); setNewType("phone"); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors py-0.5"
            data-testid="btn-add-contact"
          >
            <Plus className="w-3 h-3" />
            Pridať kontakt
          </button>
        </div>
      )}
    </div>
  );
}
