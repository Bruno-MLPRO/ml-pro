import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import logo from "@/assets/logo.jpeg";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { user, userRole, loading, signOut } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user && userRole) {
      if (userRole === 'manager') {
        navigate('/gestor/dashboard');
      } else if (userRole === 'student') {
        navigate('/aluno/dashboard');
      }
    }
    
    // Se user existe mas não tem role após loading terminar, fazer logout
    if (!loading && user && !userRole) {
      toast({
        variant: "destructive",
        title: "Erro de Autenticação",
        description: "Sua conta não está configurada corretamente. Entre em contato com o suporte.",
      });
      signOut();
    }
  }, [user, userRole, loading, navigate, signOut, toast]);

  // Show loading if checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto animate-pulse">
            <span className="text-primary-foreground font-display font-bold text-3xl">ML</span>
          </div>
          <p className="text-foreground-secondary">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 px-4">
        <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center mx-auto mb-8">
          <img src={logo} alt="ML PRO Logo" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-5xl font-display font-bold text-foreground mb-4">
          ML PRO
        </h1>
        <p className="text-xl text-foreground-secondary max-w-md mx-auto">
          Plataforma de Acompanhamento da Jornada do Aluno
        </p>
        <div className="pt-8">
          <Button
            onClick={() => navigate("/auth")}
            size="lg"
            className="bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
          >
            Fazer Login
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
