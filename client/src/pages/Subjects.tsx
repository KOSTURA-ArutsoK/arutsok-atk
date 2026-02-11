import { useState, useRef } from "react";
import { useSubjects, useCreateSubject } from "@/hooks/use-subjects";
import { useContinents, useStates } from "@/hooks/use-hierarchy";
import { useMyCompanies } from "@/hooks/use-companies";
import { Plus, Search, User, Building2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSubjectSchema } from "@shared/schema";
import { z } from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

const createSchema = insertSubjectSchema.extend({
  continentId: z.coerce.number().min(1, "Povinne"),
  stateId: z.coerce.number().min(1, "Povinne"),
  myCompanyId: z.coerce.number().min(1, "Povinne"),
});

function CreateSubjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateSubject();
  const { data: allContinents } = useContinents();
  const { data: companies } = useMyCompanies();
  const timerRef = useRef<number>(0);

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      type: "person",
      isActive: true,
      firstName: "",
      lastName: "",
      companyName: "",
    },
  });

  const watchContinent = form.watch("continentId");
  const watchType = form.watch("type");
  const { data: filteredStates } = useStates(watchContinent);

  function handleOpen(isOpen: boolean) {
    if (isOpen) timerRef.current = performance.now();
    onOpenChange(isOpen);
  }

  function onSubmit(data: z.infer<typeof createSchema>) {
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    mutate({ ...data, processingTimeSec }, {
      onSuccess: () => { handleOpen(false); form.reset(); },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registracia noveho subjektu</DialogTitle>
          <DialogDescription>
            Vytvorenie novej entity v systeme. UID bude vygenerovane automaticky podla hierarchie.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ entity</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger data-testid="select-subject-type"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="person">Fyzicka osoba</SelectItem>
                      <SelectItem value="company">Pravnicka osoba</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="myCompanyId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Spravujuca firma</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value?.toString()}>
                    <FormControl><SelectTrigger data-testid="select-managing-company"><SelectValue placeholder="Vyberte firmu" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {companies?.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {watchType === 'person' ? (
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meno</FormLabel>
                    <FormControl><Input {...field} data-testid="input-subject-firstname" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priezvisko</FormLabel>
                    <FormControl><Input {...field} data-testid="input-subject-lastname" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            ) : (
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nazov spolocnosti</FormLabel>
                  <FormControl><Input {...field} data-testid="input-subject-companyname" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="continentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kontinent</FormLabel>
                  <Select onValueChange={(val) => { field.onChange(val); form.setValue("stateId", 0); }} value={field.value?.toString()}>
                    <FormControl><SelectTrigger data-testid="select-continent"><SelectValue placeholder="Vyberte kontinent" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {allContinents?.map(c => (<SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="stateId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Stat</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value?.toString()} disabled={!watchContinent}>
                    <FormControl><SelectTrigger data-testid="select-state"><SelectValue placeholder="Vyberte stat" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {filteredStates?.map(s => (<SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="bg-muted p-3 rounded-md text-xs text-muted-foreground flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p>
                <strong>Integritne upozornenie:</strong> Vytvorenie subjektu vygeneruje permanentny, nemenitelny
                unikatny identifikator. Vsetky budu zmeny archivovane.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpen(false)} data-testid="button-cancel-subject">Zrusit</Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-subject">
                {isPending ? "Registrujem..." : "Registrovat subjekt"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Subjects() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: subjects, isLoading } = useSubjects({ search: search || undefined });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-subjects-title">Register subjektov</h2>
          <p className="text-sm text-muted-foreground mt-1">Sprava entit a integritnych zaznamov.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-subject">
          <Plus className="w-4 h-4 mr-2" />
          Novy subjekt
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hladat podla mena alebo UID..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-subjects"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UID</TableHead>
                <TableHead>Meno entity</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Spravujuca firma</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nacitavam...</TableCell></TableRow>
              )}
              {!isLoading && (!subjects || subjects.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground" data-testid="text-empty-subjects">Ziadne subjekty nenajdene</TableCell></TableRow>
              )}
              {subjects?.map((subject) => (
                <TableRow key={subject.id} data-testid={`row-subject-${subject.id}`}>
                  <TableCell className="font-mono text-xs">{subject.uid}</TableCell>
                  <TableCell className="font-medium">
                    {subject.type === 'person'
                      ? `${subject.lastName}, ${subject.firstName}`
                      : subject.companyName}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      {subject.type === 'person' ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                      <span>{subject.type === 'person' ? 'Osoba' : 'Firma'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    Firma #{subject.myCompanyId}
                  </TableCell>
                  <TableCell>
                    <Badge variant={subject.isActive ? "default" : "secondary"}>
                      {subject.isActive ? 'Aktivny' : 'Archivovany'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateSubjectDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}
