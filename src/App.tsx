import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import GestorDashboard from "./pages/GestorDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import StudentJourney from "./pages/StudentJourney";
import StudentProfile from "./pages/StudentProfile";
import JourneyManagement from "./pages/JourneyManagement";
import TeamManagement from "./pages/TeamManagement";
import StudentsManagement from "./pages/StudentsManagement";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/gestor/dashboard" element={<GestorDashboard />} />
            <Route path="/gestor/jornada" element={<JourneyManagement />} />
            <Route path="/gestor/alunos" element={<StudentsManagement />} />
            <Route path="/gestor/equipe" element={<TeamManagement />} />
            <Route path="/aluno/dashboard" element={<StudentDashboard />} />
            <Route path="/aluno/jornadas" element={<StudentJourney />} />
            <Route path="/aluno/:id" element={<StudentProfile />} />
            <Route path="/perfil" element={<Profile />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
