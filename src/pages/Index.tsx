import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

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
            onClick={() => navigate("/gestor/dashboard")}
            size="lg"
            className="bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
          >
            Acessar Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
