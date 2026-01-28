import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarLayout } from "@/components/layout-sidebar";
import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import ChatView from "@/pages/chat-view";
import SettingsPage from "@/pages/settings";
import AdminBotPage from "@/pages/admin-bot";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <SidebarLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/contacts/:id" component={ChatView} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/admin-bot" component={AdminBotPage} />
        <Route component={NotFound} />
      </Switch>
    </SidebarLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
