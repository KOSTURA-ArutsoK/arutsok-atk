import { useState } from "react";
import { useSubjects, useCreateSubject } from "@/hooks/use-subjects";
import { useContinents, useStates } from "@/hooks/use-hierarchy";
import { useMyCompanies } from "@/hooks/use-companies";
import { 
  Plus, 
  Search, 
  Filter, 
  ShieldCheck, 
  Building2, 
  User, 
  AlertTriangle 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSubjectSchema } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const createSchema = insertSubjectSchema.extend({
  continentId: z.coerce.number(),
  stateId: z.coerce.number(),
  myCompanyId: z.coerce.number(),
});

function CreateSubjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateSubject();
  const { data: continents } = useContinents();
  const { data: companies } = useMyCompanies();
  
  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      type: "person",
      isActive: true,
    }
  });

  const watchContinent = form.watch("continentId");
  const watchType = form.watch("type");
  const { data: states } = useStates(watchContinent);

  function onSubmit(data: z.infer<typeof createSchema>) {
    mutate(data, {
      onSuccess: () => {
        onOpenChange(false);
        form.reset();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle>New Subject Registration</DialogTitle>
          <DialogDescription>
            Create a new entity in the system. UID will be generated automatically based on hierarchy.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entity Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="person">Natural Person</SelectItem>
                        <SelectItem value="company">Legal Entity</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="myCompanyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Managing Firm</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your firm" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies?.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {watchType === 'person' ? (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : (
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="continentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Continent</FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val);
                      form.setValue("stateId", 0); // Reset state when continent changes
                    }} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select continent" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {continents?.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value?.toString()}
                      disabled={!watchContinent}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {states?.map(s => (
                          <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="bg-muted/50 p-3 rounded text-xs text-muted-foreground flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p>
                <strong>Integrity Notice:</strong> Creating this subject will generate a permanent, immutable unique identifier. 
                Any future modifications will archive the current version to maintain data integrity.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Registering..." : "Register Subject"}
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
  const { data: subjects, isLoading } = useSubjects({ search });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold">Subject Registry</h2>
          <p className="text-muted-foreground mt-1">Manage entities and integrity records.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          New Subject
        </Button>
      </div>

      <div className="flex gap-4 items-center bg-card p-4 rounded-lg border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or UID..." 
            className="pl-9 bg-background/50 border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">UID</th>
                <th className="px-6 py-4">Entity Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Managing Firm</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading subjects...</td>
                </tr>
              ) : subjects?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No subjects found</td>
                </tr>
              ) : (
                subjects?.map((subject) => (
                  <tr key={subject.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 font-mono text-primary group-hover:underline cursor-pointer">
                      {subject.uid}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {subject.type === 'person' 
                        ? `${subject.lastName}, ${subject.firstName}` 
                        : subject.companyName}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {subject.type === 'person' ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                        <span className="capitalize">{subject.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      Company #{subject.myCompanyId}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={subject.isActive ? 'active' : 'archived'}>
                        {subject.isActive ? 'Active' : 'Archived'}
                      </StatusBadge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <span className="sr-only">Menu</span>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateSubjectDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}
