import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

const CONTRACT_FIELDS = [
  { key: "proposalNumber", label: "Cislo navrhu" },
  { key: "kik", label: "KIK" },
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

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Settings2 className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-xl font-bold" data-testid="text-page-title">Nastavenie evidencie zmluv</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Nastavte, ktore polia su povinne pri vyplnani zmluvy (PFA).
      </p>

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
                  <TableHead>Pole</TableHead>
                  <TableHead className="w-40 text-center">Povinne pre PFA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CONTRACT_FIELDS.map(field => (
                  <TableRow key={field.key} data-testid={`row-field-${field.key}`}>
                    <TableCell className="font-medium">{field.label}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={isRequired(field.key)}
                        onCheckedChange={(checked) => toggleMutation.mutate({ fieldKey: field.key, requiredForPfa: checked })}
                        data-testid={`switch-field-${field.key}`}
                      />
                    </TableCell>
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
