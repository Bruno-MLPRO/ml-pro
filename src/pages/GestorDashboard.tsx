import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { StudentCard } from "@/components/StudentCard";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface Student {
  id: string;
  full_name: string;
  overall_progress: number;
  current_phase: string;
  status: "active" | "pending" | "blocked";
}

const GestorDashboard = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'manager')) {
      navigate('/auth');
      return;
    }

    if (user && userRole === 'manager') {
      loadStudents();
    }
  }, [user, userRole, authLoading, navigate]);

  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('student_journeys')
        .select(`
          id,
          overall_progress,
          current_phase,
          student_id,
          profiles!student_journeys_student_id_fkey (
            id,
            full_name
          )
        `);

      if (error) throw error;

      const formattedStudents: Student[] = (data || []).map((journey: any) => {
        const progress = journey.overall_progress || 0;
        let status: "active" | "pending" | "blocked" = "active";
        
        if (progress < 40) {
          status = "blocked";
        } else if (progress < 70) {
          status = "pending";
        }

        return {
          id: journey.profiles.id,
          full_name: journey.profiles.full_name,
          overall_progress: progress,
          current_phase: journey.current_phase || "Não definida",
          status,
        };
      });

      setStudents(formattedStudents);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </main>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <Sidebar />

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
          {students.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-foreground-secondary">Nenhum aluno cadastrado ainda</p>
            </div>
          ) : (
            students.map((student) => (
              <div 
                key={student.id} 
                onClick={() => navigate(`/aluno/${student.id}`)}
                className="cursor-pointer"
              >
                <StudentCard 
                  name={student.full_name}
                  turma={student.current_phase}
                  progress={student.overall_progress}
                  status={student.status}
                />
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default GestorDashboard;
