import { useState } from "react";
import { useMyCompanies, useCreateMyCompany } from "@/hooks/use-companies";
import { Plus, Building2, Briefcase } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMyCompanySchema } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Companies() {
  const { data: companies, isLoading } = useMyCompanies();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { mutate, isPending } = useCreateMyCompany();

  const form = useForm<z.infer<typeof insertMyCompanySchema>>({
    resolver: zodResolver(insertMyCompanySchema),
    defaultValues: {
      name: "",
      code: "",
      specialization: "SFA"
    }
  });

  function onSubmit(data: z.infer<typeof insertMyCompanySchema>) {
    mutate(data, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-display font-bold">My Firms</h2>
          <p className="text-muted-foreground mt-1">Strategic business units and specializations.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Register Firm
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Register New Firm</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Firm Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="specialization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specialization</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Specialization" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SFA">SFA (Specialized Financial)</SelectItem>
                          <SelectItem value="Reality">Real Estate</SelectItem>
                          <SelectItem value="Weapons">Defense & Weapons</SelectItem>
                          <SelectItem value="Tech">Technology & Cyber</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Code (2 chars)</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={2} placeholder="01" className="font-mono uppercase" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? "Registering..." : "Register Firm"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies?.map((company) => (
          <Card key={company.id} className="dashboard-card group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-bold">{company.name}</CardTitle>
              <Building2 className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded font-mono border border-primary/20">
                  CODE: {company.code}
                </span>
                <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded border border-border">
                  {company.specialization}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        {!companies?.length && !isLoading && (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-card/50 rounded border border-dashed border-border">
            No firms registered. Create your first strategic unit.
          </div>
        )}
      </div>
    </div>
  );
}
