import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Today from "@/pages/Today";
import Wardrobe from "@/pages/Wardrobe";
import Dashboard from "@/pages/Dashboard";
import Import from "@/pages/Import";
import { AppShell } from "@/components/AppShell";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Today} />
      <Route path="/wardrobe" component={Wardrobe} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/import" component={Import} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppShell>
            <AppRouter />
          </AppShell>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
