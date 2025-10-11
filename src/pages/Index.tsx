import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { user, userRole, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user && userRole) {
        if (userRole === 'manager') {
          navigate('/gestor/dashboard');
        } else if (userRole === 'student') {
          navigate('/aluno/dashboard');
        }
      } else if (user && !userRole) {
        // User is authenticated but has no role - wait for role to load
        // If role doesn't load after timeout, stay on index
        return;
      } else if (!user) {
        // User is not authenticated, show landing page
        return;
      }
    }
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 px-4">
        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-8">
          <span className="text-primary-foreground font-display font-bold text-3xl">ML</span>
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
