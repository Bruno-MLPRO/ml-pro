import { Home, Users, User, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  activeItem?: string;
}

const menuItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "alunos", label: "Alunos", icon: Users },
  { id: "perfil", label: "Perfil", icon: User },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

export const Sidebar = ({ activeItem = "home" }: SidebarProps) => {
  return (
    <aside className="w-20 min-h-screen bg-background border-r border-border flex flex-col items-center py-6 gap-6">
      {/* Logo */}
      <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
        <span className="text-primary-foreground font-display font-bold text-xl">ML</span>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 flex flex-col gap-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              size="icon"
              className={cn(
                "w-12 h-12 rounded-xl transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-foreground-secondary hover:text-foreground hover:bg-background-elevated"
              )}
              title={item.label}
            >
              <Icon className="w-5 h-5" strokeWidth={1.5} />
            </Button>
          );
        })}
      </nav>

      {/* Logout */}
      <Button
        variant="ghost"
        size="icon"
        className="w-12 h-12 rounded-xl text-foreground-secondary hover:text-destructive hover:bg-background-elevated transition-all duration-200"
        title="Sair"
      >
        <LogOut className="w-5 h-5" strokeWidth={1.5} />
      </Button>
    </aside>
  );
};
