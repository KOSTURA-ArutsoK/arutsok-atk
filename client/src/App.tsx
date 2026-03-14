import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { HelpProvider } from "@/contexts/help-context";
import { TTSProvider } from "@/contexts/tts-context";
import { useAuth } from "@/hooks/use-auth";
import { useAppUser } from "@/hooks/use-app-user";
import { Loader2 } from "lucide-react";
import type { Subject } from "@shared/schema";
import { SubjektView } from "@/components/subjekt-view";

import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Subjects from "@/pages/Subjects";
import Companies from "@/pages/Companies";
import Partners from "@/pages/Partners";
import Products from "@/pages/Products";
import Users from "@/pages/Users";
import PermissionGroups from "@/pages/PermissionGroups";
import History from "@/pages/History";
import Commissions from "@/pages/Commissions";
import Provizie from "@/pages/Provizie";
import Odmeny from "@/pages/Odmeny";
import Settings from "@/pages/Settings";
import Archive from "@/pages/Archive";
import RegisterPage from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ClientZone from "@/pages/ClientZone";
import Contracts from "@/pages/Contracts";
import ContractStatuses from "@/pages/ContractStatuses";
import ContractTemplates from "@/pages/ContractTemplates";
import ContractInventories from "@/pages/ContractInventories";
import SupiskyPage from "@/pages/Supisky";
import ClientGroups from "@/pages/ClientGroups";
import PartnerContacts from "@/pages/PartnerContacts";
import Sectors from "@/pages/Sectors";
import SektorySubjektov from "@/pages/SektorySubjektov";
import Novinky from "@/pages/Novinky";
import DokumentyNaStiahnutie from "@/pages/DokumentyNaStiahnutie";
import ExternePristupy from "@/pages/ExternePristupy";
import Kalendar from "@/pages/Kalendar";
import DobaPrihlasenia from "@/pages/DobaPrihlasenia";
import PodporaRegistracia from "@/pages/PodporaRegistracia";
import NastaveniePrehladov from "@/pages/NastaveniePrehladov";
import NastavenieOdkazov from "@/pages/NastavenieOdkazov";
import SettingsStates from "@/pages/SettingsStates";
import SettingsDivisions from "@/pages/SettingsDivisions";
import ContractForm from "@/pages/ContractForm";
import ContractFieldSettings from "@/pages/ContractFieldSettings";
import Body from "@/pages/Body";
import BulkImport from "@/pages/BulkImport";
import ImportArchive from "@/pages/ImportArchive";
import BulkActions from "@/pages/BulkActions";
import ProfilSubjektu from "@/pages/ProfilSubjektu";
import Reports from "@/pages/Reports";
import DatatovaLinka from "@/pages/DatatovaLinka";
import DigitalneZmluvy from "@/pages/DigitalneZmluvy";
import HoldingDashboard from "@/pages/HoldingDashboard";
import NetworkSiet from "@/pages/NetworkSiet";
import MojeUlohy from "@/pages/MojeUlohy";
import Ziadosti from "@/pages/Ziadosti";
import Prestup from "@/pages/Prestup";
import ReportyOdosielanie from "@/pages/ReportyOdosielanie";
import ReportyNBS from "@/pages/ReportyNBS";
import ObchodnePrilezitosti from "@/pages/ObchodnePrilezitosti";
import NastavenieObchodnychPrilezitosti from "@/pages/NastavenieObchodnychPrilezitosti";
import { AppShell } from "@/components/layout/AppShell";
import { RedListNotificationPopup } from "@/components/red-list-notification-popup";
import { BlackListNotificationPopup } from "@/components/black-list-notification-popup";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <AppShell>
      {children}
    </AppShell>
  );
}

function ClientProfilePage() {
  const { data: appUser } = useAppUser();
  const { data: subject, isLoading } = useQuery<Subject>({
    queryKey: ['/api/subjects', appUser?.linkedSubjectId],
    queryFn: () => fetch(`/api/subjects/${appUser?.linkedSubjectId}`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!appUser?.linkedSubjectId,
  });

  if (isLoading || !subject) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return <SubjektView subject={subject} isClientView={true} />;
}

function LoginRedirect() {
  window.location.href = "/api/login";
  return null;
}

const PrivateDashboard = () => <PrivateRoute><Dashboard /></PrivateRoute>;
const PrivateSubjects = () => <PrivateRoute><Subjects /></PrivateRoute>;
const PrivateCompanies = () => <PrivateRoute><Companies /></PrivateRoute>;
const PrivatePartners = () => <PrivateRoute><Partners /></PrivateRoute>;
const PrivateProducts = () => <PrivateRoute><Products /></PrivateRoute>;
const PrivateCommissions = () => <PrivateRoute><Commissions /></PrivateRoute>;
const PrivateBody = () => <PrivateRoute><Body /></PrivateRoute>;
const PrivateProvizie = () => <PrivateRoute><Provizie /></PrivateRoute>;
const PrivateOdmeny = () => <PrivateRoute><Odmeny /></PrivateRoute>;
const PrivateSettings = () => <PrivateRoute><Settings /></PrivateRoute>;
const PrivateHistory = () => <PrivateRoute><History /></PrivateRoute>;
const PrivateUsers = () => <PrivateRoute><Users /></PrivateRoute>;
const PrivatePermissionGroups = () => <PrivateRoute><PermissionGroups /></PrivateRoute>;
const PrivateArchive = () => <PrivateRoute><Archive /></PrivateRoute>;
const PrivateContracts = () => <PrivateRoute><Contracts /></PrivateRoute>;
const PrivateContractForm = () => <PrivateRoute><ContractForm /></PrivateRoute>;
const PrivateContractStatuses = () => <PrivateRoute><ContractStatuses /></PrivateRoute>;
const PrivateContractTemplates = () => <PrivateRoute><ContractTemplates /></PrivateRoute>;
const PrivateContractFieldSettings = () => <PrivateRoute><ContractFieldSettings /></PrivateRoute>;
const PrivateContractInventories = () => <PrivateRoute><ContractInventories /></PrivateRoute>;
const PrivateSupisky = () => <PrivateRoute><SupiskyPage /></PrivateRoute>;
const PrivateClientGroups = () => <PrivateRoute><ClientGroups /></PrivateRoute>;
const PrivatePartnerContacts = () => <PrivateRoute><PartnerContacts /></PrivateRoute>;
const PrivateSectors = () => <PrivateRoute><Sectors /></PrivateRoute>;
const PrivateSektorySubjektov = () => <PrivateRoute><SektorySubjektov /></PrivateRoute>;
const PrivateNovinky = () => <PrivateRoute><Novinky /></PrivateRoute>;
const PrivateDokumenty = () => <PrivateRoute><DokumentyNaStiahnutie /></PrivateRoute>;
const PrivateExterne = () => <PrivateRoute><ExternePristupy /></PrivateRoute>;
const PrivateKalendar = () => <PrivateRoute><Kalendar /></PrivateRoute>;
const PrivateDobaPrihlasenia = () => <PrivateRoute><DobaPrihlasenia /></PrivateRoute>;
const PrivatePodpora = () => <PrivateRoute><PodporaRegistracia /></PrivateRoute>;
const PrivateNastaveniePrehladov = () => <PrivateRoute><NastaveniePrehladov /></PrivateRoute>;
const PrivateNastavenieOdkazov = () => <PrivateRoute><NastavenieOdkazov /></PrivateRoute>;
const PrivateSettingsStates = () => <PrivateRoute><SettingsStates /></PrivateRoute>;
const PrivateSettingsDivisions = () => <PrivateRoute><SettingsDivisions /></PrivateRoute>;
const PrivateBulkImport = () => <PrivateRoute><BulkImport /></PrivateRoute>;
const PrivateImportArchive = () => <PrivateRoute><ImportArchive /></PrivateRoute>;
const PrivateBulkActions = () => <PrivateRoute><BulkActions /></PrivateRoute>;
const PrivateProfilSubjektu = () => <PrivateRoute><ProfilSubjektu /></PrivateRoute>;
const PrivateReports = () => <PrivateRoute><Reports /></PrivateRoute>;
const PrivateDatatovaLinka = () => <PrivateRoute><DatatovaLinka /></PrivateRoute>;
const PrivateDigitalneZmluvy = () => <PrivateRoute><DigitalneZmluvy /></PrivateRoute>;
const PrivateHoldingDashboard = () => <PrivateRoute><HoldingDashboard /></PrivateRoute>;
const PrivateNetworkSiet = () => <PrivateRoute><NetworkSiet /></PrivateRoute>;
const PrivateMojeUlohy = () => <PrivateRoute><MojeUlohy /></PrivateRoute>;
const PrivateZiadosti = () => <PrivateRoute><Ziadosti /></PrivateRoute>;
const PrivatePrestup = () => <PrivateRoute><Prestup /></PrivateRoute>;
const PrivateReportyOdosielanie = () => <PrivateRoute><ReportyOdosielanie /></PrivateRoute>;
const PrivateReportyNBS = () => <PrivateRoute><ReportyNBS /></PrivateRoute>;
const PrivateObchodnePrilezitosti = () => <PrivateRoute><ObchodnePrilezitosti /></PrivateRoute>;
const PrivateNastavenieObchodnychPrilezitosti = () => <PrivateRoute><NastavenieObchodnychPrilezitosti /></PrivateRoute>;
const PrivateClientProfile = () => <PrivateRoute><ClientProfilePage /></PrivateRoute>;

function Router() {
  return (
    <Switch>
      <Route path="/api/login" component={LoginRedirect} />

      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/client-zone" component={ClientZone} />
      <Route path="/client-profile" component={PrivateClientProfile} />
      
      <Route path="/" component={PrivateDashboard} />
      <Route path="/subjects" component={PrivateSubjects} />
      <Route path="/companies" component={PrivateCompanies} />
      <Route path="/partners" component={PrivatePartners} />
      <Route path="/products" component={PrivateProducts} />
      <Route path="/commissions" component={PrivateCommissions} />
      <Route path="/body" component={PrivateBody} />
      <Route path="/provizie" component={PrivateProvizie} />
      <Route path="/odmeny" component={PrivateOdmeny} />
      <Route path="/settings" component={PrivateSettings} />
      <Route path="/history" component={PrivateHistory} />
      <Route path="/users" component={PrivateUsers} />
      <Route path="/permission-groups" component={PrivatePermissionGroups} />
      <Route path="/archive" component={PrivateArchive} />
      <Route path="/contracts" component={PrivateContracts} />
      <Route path="/evidencia-zmluv" component={PrivateContracts} />
      <Route path="/contracts/new" component={PrivateContractForm} />
      <Route path="/contracts/:id/edit" component={PrivateContractForm} />
      <Route path="/contract-statuses" component={PrivateContractStatuses} />
      <Route path="/contract-template-settings" component={PrivateContractTemplates} />
      <Route path="/contract-template-management" component={PrivateContractTemplates} />
      <Route path="/contract-field-settings" component={PrivateContractFieldSettings} />
      <Route path="/contract-inventories" component={PrivateContractInventories} />
      <Route path="/supisky" component={PrivateSupisky} />
      <Route path="/client-groups" component={PrivateClientGroups} />
      <Route path="/partner-contacts" component={PrivatePartnerContacts} />
      <Route path="/sektory-zmluv" component={PrivateSectors} />
      <Route path="/sectors" component={PrivateSectors} />
      <Route path="/sektory-subjektov" component={PrivateSektorySubjektov} />
      <Route path="/novinky" component={PrivateNovinky} />
      <Route path="/dokumenty-na-stiahnutie" component={PrivateDokumenty} />
      <Route path="/externe-pristupy" component={PrivateExterne} />
      <Route path="/kalendar" component={PrivateKalendar} />
      <Route path="/doba-prihlasenia" component={PrivateDobaPrihlasenia} />
      <Route path="/support" component={PrivatePodpora} />
      <Route path="/analytika" component={PrivateReports} />
      <Route path="/holding-dashboard" component={PrivateHoldingDashboard} />
      <Route path="/dashboard-settings" component={PrivateNastaveniePrehladov} />
      <Route path="/link-settings" component={PrivateNastavenieOdkazov} />
      <Route path="/settings-states" component={PrivateSettingsStates} />
      <Route path="/settings-divisions" component={PrivateSettingsDivisions} />
      <Route path="/settings-companies" component={PrivateCompanies} />
      <Route path="/bulk-import" component={PrivateBulkImport} />
      <Route path="/import-archive" component={PrivateImportArchive} />
      <Route path="/bulk-actions" component={PrivateBulkActions} />
      <Route path="/profil-subjektu" component={PrivateProfilSubjektu} />
      <Route path="/datova-linka" component={PrivateDatatovaLinka} />
      <Route path="/digitalne-zmluvy" component={PrivateDigitalneZmluvy} />
      <Route path="/siet" component={PrivateNetworkSiet} />
      <Route path="/moje-ulohy" component={PrivateMojeUlohy} />
      <Route path="/ziadosti" component={PrivateZiadosti} />
      <Route path="/prestup" component={PrivatePrestup} />
      <Route path="/reporty-odosielanie" component={PrivateReportyOdosielanie} />
      <Route path="/reporty-nbs" component={PrivateReportyNBS} />
      <Route path="/obchodne-prilezitosti" component={PrivateObchodnePrilezitosti} />
      <Route path="/nastavenie-obchodnych-prilezitosti" component={PrivateNastavenieObchodnychPrilezitosti} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <HelpProvider>
          <TTSProvider>
            <TooltipProvider>
              <Toaster />
              <RedListNotificationPopup />
              <BlackListNotificationPopup />
              <Router />
            </TooltipProvider>
          </TTSProvider>
        </HelpProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
