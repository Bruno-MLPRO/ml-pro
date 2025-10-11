import { User, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface StudentCardProps {
  name: string;
  turma: string;
  progress: number;
  status?: "active" | "pending" | "blocked";
}

export const StudentCard = ({ 
  name, 
  turma, 
  progress,
  status = "active" 
}: StudentCardProps) => {
  const statusColors = {
    active: "text-success",
    pending: "text-warning",
    blocked: "text-destructive"
  };

  return (
    <Card className="bg-card border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group">
      <CardContent className="p-6">
        {/* Avatar and Name */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-background-elevated flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
            <User className="w-6 h-6 text-foreground-secondary group-hover:text-primary transition-colors" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg font-semibold text-foreground mb-1 truncate">
              {name}
            </h3>
            <p className="text-sm text-foreground-secondary truncate">
              {turma}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-foreground-secondary">Progresso</span>
            <span className="text-sm font-medium text-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-4 h-4 ${statusColors[status]}`} strokeWidth={1.5} />
          <span className="text-sm text-foreground-secondary">
            {status === "active" && "Em progresso"}
            {status === "pending" && "Pendente validação"}
            {status === "blocked" && "Bloqueado"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
