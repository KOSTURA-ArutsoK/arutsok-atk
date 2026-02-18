import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import type { Partner, PartnerContact } from "@shared/schema";
import { Loader2, Phone, Mail, Shield, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PARTNER_CONTACTS_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "firstName", label: "Meno", type: "text" },
  { key: "partnerName", label: "Partner", type: "text" },
  { key: "position", label: "Pozicia", type: "text" },
  { key: "phone", label: "Telefon", type: "number" },
  { key: "email", label: "Email", type: "text" },
];

const PARTNER_CONTACTS_COLUMNS: ColumnDef[] = [
  { key: "firstName", label: "Meno" },
  { key: "partnerName", label: "Partner" },
  { key: "position", label: "Pozicia" },
  { key: "phone", label: "Telefon" },
  { key: "email", label: "Email" },
  { key: "securityLevel", label: "Bezpecnost" },
  { key: "isActive", label: "Stav" },
];

type PartnerContactWithPartner = PartnerContact & { partnerName?: string };

export default function PartnerContacts() {
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

  const preFilteredContacts = (allContacts || []).filter(c => {
    return filterActive === "all" || (filterActive === "active" ? c.isActive : !c.isActive);
  });

  const tableFilter = useSmartFilter(preFilteredContacts, PARTNER_CONTACTS_FILTER_COLUMNS, "partner-contacts");
  const { sortedData: sortedContacts, sortKey, sortDirection, requestSort } = useTableSort(tableFilter.filteredData);
  const columnVisibility = useColumnVisibility("partner-contacts", PARTNER_CONTACTS_COLUMNS);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Kontaktne osoby</h1>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <ColumnManager columnVisibility={columnVisibility} />
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

      <SmartFilterBar filter={tableFilter} />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columnVisibility.isVisible("firstName") && <TableHead sortKey="firstName" sortDirection={sortKey === "firstName" ? sortDirection : null} onSort={requestSort}>Meno</TableHead>}
                  {columnVisibility.isVisible("partnerName") && <TableHead sortKey="partnerName" sortDirection={sortKey === "partnerName" ? sortDirection : null} onSort={requestSort}>Partner</TableHead>}
                  {columnVisibility.isVisible("position") && <TableHead sortKey="position" sortDirection={sortKey === "position" ? sortDirection : null} onSort={requestSort}>Pozicia</TableHead>}
                  {columnVisibility.isVisible("phone") && <TableHead sortKey="phone" sortDirection={sortKey === "phone" ? sortDirection : null} onSort={requestSort}>Telefon</TableHead>}
                  {columnVisibility.isVisible("email") && <TableHead sortKey="email" sortDirection={sortKey === "email" ? sortDirection : null} onSort={requestSort}>Email</TableHead>}
                  {columnVisibility.isVisible("securityLevel") && <TableHead sortKey="securityLevel" className="w-24 text-center" sortDirection={sortKey === "securityLevel" ? sortDirection : null} onSort={requestSort}>Bezpecnost</TableHead>}
                  {columnVisibility.isVisible("isActive") && <TableHead sortKey="isActive" className="w-24 text-center" sortDirection={sortKey === "isActive" ? sortDirection : null} onSort={requestSort}>Stav</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedContacts.map((contact) => (
                  <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                    {columnVisibility.isVisible("firstName") && <TableCell className="font-medium">
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
                    </TableCell>}
                    {columnVisibility.isVisible("partnerName") && <TableCell>
                      <span className="text-sm">{contact.partnerName}</span>
                    </TableCell>}
                    {columnVisibility.isVisible("position") && <TableCell>
                      <span className="text-sm text-muted-foreground">{contact.position || "-"}</span>
                    </TableCell>}
                    {columnVisibility.isVisible("phone") && <TableCell>
                      {contact.phone ? (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{contact.phone}</span>
                        </div>
                      ) : "-"}
                    </TableCell>}
                    {columnVisibility.isVisible("email") && <TableCell>
                      {contact.email ? (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{contact.email}</span>
                        </div>
                      ) : "-"}
                    </TableCell>}
                    {columnVisibility.isVisible("securityLevel") && <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Shield className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">{contact.securityLevel}</span>
                      </div>
                    </TableCell>}
                    {columnVisibility.isVisible("isActive") && <TableCell className="text-center">
                      {contact.isActive ? (
                        <Badge variant="default" className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Aktivny</Badge>
                      ) : (
                        <Badge variant="default" className="bg-destructive/20 text-destructive border-destructive/30">Neaktivny</Badge>
                      )}
                    </TableCell>}
                  </TableRow>
                ))}
                {tableFilter.filteredData.length === 0 && (
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
