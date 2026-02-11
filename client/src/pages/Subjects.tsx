import { useState, useRef } from "react";
import { useSubjects, useCreateSubject, useSubjectCareerHistory } from "@/hooks/use-subjects";
import { useContinents, useStates } from "@/hooks/use-hierarchy";
import { useMyCompanies } from "@/hooks/use-companies";
import { Plus, Search, User, Building2, AlertTriangle, Eye, Calendar, Briefcase, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import type { Subject } from "@shared/schema";
import { z } from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

const createSchema = insertSubjectSchema.extend({
  continentId: z.coerce.number().min(1, "Povinne"),
  stateId: z.coerce.number().min(1, "Povinne"),
  myCompanyId: z.coerce.number().min(1, "Povinne"),
});

function SubjectDetailDialog({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const { data: careerHistory, isLoading } = useSubjectCareerHistory(subject.id);
  const { data: companies } = useMyCompanies();
  const managingCompany = companies?.find(c => c.id === subject.myCompanyId);

  function formatDate(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString("sk-SK");
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              {subject.type === 'person' ? <User className="w-5 h-5 text-primary" /> : <Building2 className="w-5 h-5 text-primary" />}
            </div>
            <div className="min-w-0">
              <DialogTitle data-testid="text-subject-detail-name">
                {subject.type === 'person'
                  ? `${subject.lastName}, ${subject.firstName}`
                  : subject.companyName}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">{subject.uid}</span>
                <Badge variant={subject.isActive ? "default" : "destructive"} className={subject.isActive ? "bg-emerald-600 text-white" : ""}>
                  {subject.isActive ? "Aktivny" : "Archivovany"}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-muted-foreground">Typ entity</span>
              <p className="text-sm">{subject.type === 'person' ? 'Fyzicka osoba' : 'Pravnicka osoba'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Spravujuca firma</span>
              <p className="text-sm">{managingCompany?.name || `Firma #${subject.myCompanyId}`}</p>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Briefcase className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Historia kariery v systeme</h3>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nacitavam historiu...</p>
            ) : !careerHistory || careerHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-career-history">
                Ziadna historia vazby v systeme
              </p>
            ) : (
              <div className="relative space-y-0">
                <div className="absolute left-4 top-3 bottom-3 w-px bg-border" />
                {careerHistory.map((entry, idx) => (
                  <div key={idx} className="relative pl-10 py-3" data-testid={`career-entry-${idx}`}>
                    <div className={`absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 ${
                      entry.isActive 
                        ? 'bg-primary border-primary' 
                        : 'bg-muted border-muted-foreground/40'
                    }`} />
                    <div className="flex items-start gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{entry.entityName}</span>
                          <Badge variant={entry.type === 'internal' ? 'default' : 'outline'}>
                            {entry.type === 'internal' ? 'Interny' : 'Externy'}
                          </Badge>
                          {entry.isActive && <Badge variant="secondary">Aktivny</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{entry.role}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(entry.validFrom) || "-"}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span>{entry.isActive && !entry.validTo ? "Sucasnost" : (formatDate(entry.validTo) || "-")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
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
                    <FormControl><Input {...field} value={field.value || ""} data-testid="input-subject-firstname" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priezvisko</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} data-testid="input-subject-lastname" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            ) : (
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nazov spolocnosti</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} data-testid="input-subject-companyname" /></FormControl>
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
  const [viewTarget, setViewTarget] = useState<Subject | null>(null);
  const { data: subjects, isLoading } = useSubjects({ search: search || undefined });
  const { data: companies } = useMyCompanies();

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
                <TableHead className="w-[60px]">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nacitavam...</TableCell></TableRow>
              )}
              {!isLoading && (!subjects || subjects.length === 0) && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground" data-testid="text-empty-subjects">Ziadne subjekty nenajdene</TableCell></TableRow>
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
                    {companies?.find(c => c.id === subject.myCompanyId)?.name || `Firma #${subject.myCompanyId}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={subject.isActive ? "default" : "destructive"} className={subject.isActive ? "bg-emerald-600 text-white" : ""}>
                      {subject.isActive ? 'Aktivny' : 'Archivovany'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => setViewTarget(subject)} data-testid={`button-view-subject-${subject.id}`}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateSubjectDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
      {viewTarget && <SubjectDetailDialog subject={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}
