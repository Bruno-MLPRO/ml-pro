import { Home, Users, User, Settings, LogOut, ListChecks, GraduationCap, UsersRound, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "@/assets/logo.jpeg";

export const Sidebar = () => {
  const { signOut, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <aside className="w-20 min-h-screen bg-background border-r border-border flex flex-col items-center py-6 gap-6">
      {/* Logo */}
      <div className="w-12 h-12 rounded-xl overflow-hidden mb-4">
        <img src={logo} alt="ML PRO Logo" className="w-full h-full object-cover" />
      </div>

      {/* Menu Items */}
      <nav className="flex-1 flex flex-col gap-2">
      {userRole === 'manager' ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/gestor/dashboard')}
              className={cn(
                "w-12 h-12 rounded-xl transition-all duration-200",
                location.pathname === '/gestor/dashboard'
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-foreground-secondary hover:text-foreground hover:bg-background-elevated"
              )}
              title="Dashboard"
            >
              <Home className="w-5 h-5" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/gestor/jornada')}
              className={cn(
                "w-12 h-12 rounded-xl transition-all duration-200",
                location.pathname === '/gestor/jornada'
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-foreground-secondary hover:text-foreground hover:bg-background-elevated"
              )}
              title="Editar Jornada"
            >
              <ListChecks className="w-5 h-5" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/gestor/alunos')}
              className={cn(
                "w-12 h-12 rounded-xl transition-all duration-200",
                location.pathname === '/gestor/alunos'
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-foreground-secondary hover:text-foreground hover:bg-background-elevated"
              )}
              title="Alunos"
            >
              <GraduationCap className="w-5 h-5" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/gestor/equipe')}
              className={cn(
                "w-12 h-12 rounded-xl transition-all duration-200",
                location.pathname === '/gestor/equipe'
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-foreground-secondary hover:text-foreground hover:bg-background-elevated"
              )}
              title="Equipe"
            >
              <UsersRound className="w-5 h-5" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/perfil')}
              className={cn(
                "w-12 h-12 rounded-xl transition-all duration-200",
                location.pathname === '/perfil'
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-foreground-secondary hover:text-foreground hover:bg-background-elevated"
              )}
              title="Perfil"
            >
              <User className="w-5 h-5" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/configuracoes')}
              className={cn(
                "w-12 h-12 rounded-xl transition-all duration-200",
                location.pathname === '/configuracoes'
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-foreground-secondary hover:text-foreground hover:bg-background-elevated"
              )}
              title="Configurações"
            >
              <Settings className="w-5 h-5" strokeWidth={1.5} />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/aluno/dashboard')}
              className={cn(
                "w-12 h-12 rounded-xl transition-all duration-200",
                location.pathname === '/aluno/dashboard'
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-foreground-secondary hover:text-foreground hover:bg-background-elevated"
              )}
              title="Dashboard"
            >
              <Home className="w-5 h-5" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/aluno/contas-ml')}
              className={cn(
                "w-12 h-12 rounded-xl transition-all duration-200",
                location.pathname.startsWith('/aluno/contas-ml')
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-foreground-secondary hover:text-foreground hover:bg-background-elevated"
              )}
              title="Contas ML"
            >
              <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/aluno/jornadas')}
              className={cn(
                "w-12 h-12 rounded-xl transition-all duration-200",
                location.pathname === '/aluno/jornadas'
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-foreground-secondary hover:text-foreground hover:bg-background-elevated"
              )}
              title="Jornadas"
            >
              <ListChecks className="w-5 h-5" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/perfil')}
              className={cn(
                "w-12 h-12 rounded-xl transition-all duration-200",
                location.pathname === '/perfil'
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-foreground-secondary hover:text-foreground hover:bg-background-elevated"
              )}
              title="Perfil"
            >
              <User className="w-5 h-5" strokeWidth={1.5} />
            </Button>
          </>
        )}
      </nav>

      {/* Logout */}
      <Button
        variant="ghost"
        size="icon"
        onClick={signOut}
        className="w-12 h-12 rounded-xl text-foreground-secondary hover:text-destructive hover:bg-background-elevated transition-all duration-200"
        title="Sair"
      >
        <LogOut className="w-5 h-5" strokeWidth={1.5} />
      </Button>
    </aside>
  );
};
