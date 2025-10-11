import { Sidebar } from "@/components/Sidebar";
import { StudentCard } from "@/components/StudentCard";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const mockStudents = [
  { name: "Carlos Silva", turma: "Turma 4 - Starter", progress: 75, status: "active" as const },
  { name: "Ana Costa", turma: "Turma 4 - Starter", progress: 45, status: "pending" as const },
  { name: "João Oliveira", turma: "Turma 3 - Pro", progress: 90, status: "active" as const },
  { name: "Maria Santos", turma: "Turma 4 - Starter", progress: 30, status: "blocked" as const },
  { name: "Pedro Alves", turma: "Turma 3 - Pro", progress: 65, status: "active" as const },
  { name: "Lucia Fernandes", turma: "Turma 4 - Starter", progress: 85, status: "active" as const },
];

const GestorDashboard = () => {
  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <Sidebar activeItem="home" />

      {/* Main Content */}
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold text-foreground mb-2">
            Visão Geral dos Alunos
          </h1>
          <p className="text-foreground-secondary">
            Acompanhe o progresso e a jornada de cada aluno da consultoria
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-secondary" strokeWidth={1.5} />
            <Input
              placeholder="Buscar aluno..."
              className="pl-10 bg-input border-border focus:border-primary focus:ring-primary"
            />
          </div>
        </div>

        {/* Students Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockStudents.map((student, index) => (
            <StudentCard
              key={index}
              name={student.name}
              turma={student.turma}
              progress={student.progress}
              status={student.status}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default GestorDashboard;
