import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Circle, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Milestone {
  id: string;
  title: string;
  description: string;
  phase: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  progress: number;
  order_index: number;
}

interface Journey {
  overall_progress: number;
  current_phase: string;
}

const StudentJourney = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'student')) {
      navigate('/auth');
      return;
    }

    if (user && userRole === 'student') {
      loadJourneyData();
    }
  }, [user, userRole, authLoading, navigate]);

  const loadJourneyData = async () => {
    try {
      const { data: journeyData, error: journeyError } = await supabase
        .from('student_journeys')
        .select('*')
        .eq('student_id', user!.id)
        .single();

      if (journeyError) throw journeyError;
      setJourney(journeyData);

      const { data: milestonesData, error: milestonesError } = await supabase
        .from('milestones')
        .select('*')
        .eq('journey_id', journeyData.id)
        .order('order_index');

      if (milestonesError) throw milestonesError;
      setMilestones(milestonesData || []);
    } catch (error) {
      console.error('Error loading journey:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-6 h-6 text-success" />;
      case 'in_progress':
        return <Loader2 className="w-6 h-6 text-primary animate-spin" />;
      case 'blocked':
        return <AlertCircle className="w-6 h-6 text-warning" />;
      default:
        return <Circle className="w-6 h-6 text-foreground-secondary" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      not_started: 'secondary',
      in_progress: 'default',
      completed: 'outline',
      blocked: 'destructive',
    };

    const labels: Record<string, string> = {
      not_started: 'Não Iniciado',
      in_progress: 'Em Progresso',
      completed: 'Concluído',
      blocked: 'Bloqueado',
    };

    return (
      <Badge variant={variants[status] as any}>
        {labels[status]}
      </Badge>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 ml-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 ml-64">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-display font-semibold text-foreground mb-2">
            Minha Jornada
          </h1>
          <p className="text-foreground-secondary mb-8">
            Acompanhe seu progresso e conquiste suas metas
          </p>

          {journey && (
            <Card className="p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-display font-semibold text-foreground">
                  Progresso Geral
                </h2>
                <span className="text-2xl font-bold text-primary">
                  {journey.overall_progress}%
                </span>
              </div>
              <Progress value={journey.overall_progress} className="h-3 mb-2" />
              {journey.current_phase && (
                <p className="text-sm text-foreground-secondary mt-2">
                  Fase Atual: <span className="text-foreground font-semibold">{journey.current_phase}</span>
                </p>
              )}
            </Card>
          )}

          <div className="space-y-4">
            <h2 className="text-2xl font-display font-semibold text-foreground mb-4">
              Etapas da Jornada
            </h2>

            {milestones.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-foreground-secondary">
                  Nenhuma etapa cadastrada ainda. Entre em contato com seu gestor.
                </p>
              </Card>
            ) : (
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-background-elevated" />
                {milestones.map((milestone, index) => (
                  <Card key={milestone.id} className="p-6 mb-4 relative ml-16">
                    <div className="absolute -left-16 top-6">
                      {getStatusIcon(milestone.status)}
                    </div>
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-semibold text-foreground">
                        {milestone.title}
                      </h3>
                      <Badge variant="outline">{milestone.phase}</Badge>
                    </div>
                    {milestone.description && (
                      <p className="text-foreground-secondary mb-3">
                        {milestone.description}
                      </p>
                    )}
                    <div>
                      {getStatusBadge(milestone.status)}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentJourney;
