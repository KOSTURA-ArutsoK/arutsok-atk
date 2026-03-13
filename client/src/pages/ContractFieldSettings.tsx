import { useState } from "react";
import { NAVRH_LABEL_FULL } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import type { ContractFieldSetting } from "@shared/schema";
import { Loader2, Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const FIELD_SETTINGS_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "label", label: "Pole", type: "text" },
];

const FIELD_SETTINGS_COLUMNS: ColumnDef[] = [
  { key: "label", label: "Pole" },
  { key: "requiredForPfa", label: "Povinne pre PFA" },
];

const CONTRACT_FIELDS = [
  { key: "proposalNumber", label: NAVRH_LABEL_FULL },
  { key: "globalNumber", label: "Cislo kontraktu" },
  { key: "signingPlace", label: "Miesto podpisu" },
  { key: "contractType", label: "Typ zmluvy" },
  { key: "paymentFrequency", label: "Frekvencia platby" },
  { key: "annualPremium", label: "Rocne poistne" },
];

export default function ContractFieldSettings() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<ContractFieldSetting[]>({
    queryKey: ["/api/contract-field-settings"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ fieldKey, requiredForPfa }: { fieldKey: string; requiredForPfa: boolean }) => {
      await apiRequest("PUT", "/api/contract-field-settings", { fieldKey, requiredForPfa });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-field-settings"] });
      toast({ title: "Nastavenie ulozene" });
    },
    onError: () => {
      toast({ title: "Chyba pri ukladani", variant: "destructive" });
    },
  });

  function isRequired(fieldKey: string): boolean {
    const setting = settings?.find(s => s.fieldKey === fieldKey);
    return setting?.requiredForPfa ?? false;
  }

  const tableFilter = useSmartFilter(CONTRACT_FIELDS, FIELD_SETTINGS_FILTER_COLUMNS, "contract-field-settings");
  const { sortedData: sortedFields, sortKey, sortDirection, requestSort } = useTableSort(tableFilter.filteredData);
  const columnVisibility = useColumnVisibility("contract-field-settings", FIELD_SETTINGS_COLUMNS);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Settings2 className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-xl font-bold" data-testid="text-page-title">Nastavenie evidencie zmluv</h1>
        <div className="ml-auto">
          <ColumnManager columnVisibility={columnVisibility} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Nastavte, ktore polia su povinne pri vyplnani zmluvy (PFA).
      </p>

      <SmartFilterBar filter={tableFilter} />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {columnVisibility.isVisible("label") && <TableHead sortKey="label" sortDirection={sortKey === "label" ? sortDirection : null} onSort={requestSort}>Pole</TableHead>}
                  {columnVisibility.isVisible("requiredForPfa") && <TableHead className="w-40 text-center">Povinne pre PFA</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFields.map(field => (
                  <TableRow key={field.key} data-testid={`row-field-${field.key}`}>
                    {columnVisibility.isVisible("label") && <TableCell className="font-medium">{field.label}</TableCell>}
                    {columnVisibility.isVisible("requiredForPfa") && <TableCell className="text-center">
                      <Switch
                        checked={isRequired(field.key)}
                        onCheckedChange={(checked) => toggleMutation.mutate({ fieldKey: field.key, requiredForPfa: checked })}
                        data-testid={`switch-field-${field.key}`}
                      />
                    </TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
