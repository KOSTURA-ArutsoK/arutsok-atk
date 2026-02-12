import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Partner, PartnerContact } from "@shared/schema";
import { Loader2, Phone, Mail, Shield, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type PartnerContactWithPartner = PartnerContact & { partnerName?: string };

export default function PartnerContacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");

  const { data: partners, isLoading: partnersLoading } = useQuery<Partner[]>({
    queryKey: ["/api/partners"],
  });

  const activePartners = (partners || []).filter(p => !p.isDeleted);

  const { data: allContacts, isLoading: contactsLoading } = useQuery<PartnerContactWithPartner[]>({
    queryKey: ["/api/partner-contacts/all"],
    queryFn: async () => {
      if (!activePartners.length) return [];
      const results: PartnerContactWithPartner[] = [];
      for (const partner of activePartners) {
        const res = await fetch(`/api/partners/${partner.id}/contacts`, { credentials: "include" });
        if (res.ok) {
          const contacts: PartnerContact[] = await res.json();
          contacts.forEach(c => results.push({ ...c, partnerName: partner.name }));
        }
      }
      return results;
    },
    enabled: activePartners.length > 0,
  });

  const isLoading = partnersLoading || contactsLoading;

  const filteredContacts = (allContacts || []).filter(c => {
    const nameMatch = `${c.firstName} ${c.lastName} ${c.partnerName || ""} ${c.email || ""} ${c.phone || ""}`.toLowerCase().includes(searchQuery.toLowerCase());
    const activeMatch = filterActive === "all" || (filterActive === "active" ? c.isActive : !c.isActive);
    return nameMatch && activeMatch;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Kontaktne osoby</h1>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Vyhladat kontaktnu osobu..."
            data-testid="input-search-contacts"
          />
        </div>
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-active">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsetky</SelectItem>
            <SelectItem value="active">Aktivne</SelectItem>
            <SelectItem value="inactive">Neaktivne</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meno</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Pozicia</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-24 text-center">Bezpecnost</TableHead>
                  <TableHead className="w-24 text-center">Stav</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {contact.titleBefore ? `${contact.titleBefore} ` : ""}
                          {contact.firstName} {contact.lastName}
                          {contact.titleAfter ? `, ${contact.titleAfter}` : ""}
                        </span>
                        {contact.isPrimary && (
                          <Badge variant="default" className="text-[10px]">Primarny</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{contact.partnerName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{contact.position || "-"}</span>
                    </TableCell>
                    <TableCell>
                      {contact.phone ? (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{contact.phone}</span>
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{contact.email}</span>
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Shield className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">{contact.securityLevel}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {contact.isActive ? (
                        <Badge variant="default" className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Aktivny</Badge>
                      ) : (
                        <Badge variant="default" className="bg-destructive/20 text-destructive border-destructive/30">Neaktivny</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredContacts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      Ziadne kontaktne osoby
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
