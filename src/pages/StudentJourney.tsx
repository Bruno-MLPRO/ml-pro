import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Circle, AlertCircle, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
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
  const [journeys, setJourneys] = useState<any[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'student')) {
      navigate('/auth');
      return;
    }

    if (user && userRole === 'student') {
      loadJourneys();
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    if (selectedJourneyId) {
      loadJourneyData(selectedJourneyId);
    }
  }, [selectedJourneyId]);

  const loadJourneys = async () => {
    try {
      const { data: journeysData, error: journeysError } = await supabase
        .from('student_journeys')
        .select('*')
        .eq('student_id', user!.id);

      if (journeysError) throw journeysError;
      
      setJourneys(journeysData || []);
      if (journeysData && journeysData.length > 0) {
        setSelectedJourneyId(journeysData[0].id);
      }
    } catch (error) {
      console.error('Error loading journeys:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadJourneyData = async (journeyId: string) => {
    try {
      const { data: journeyData, error: journeyError } = await supabase
        .from('student_journeys')
        .select('*')
        .eq('id', journeyId)
        .single();

      if (journeyError) throw journeyError;
      setJourney(journeyData);

      const { data: milestonesData, error: milestonesError } = await supabase
        .from('milestones')
        .select('*')
        .eq('journey_id', journeyId)
        .order('order_index');

      if (milestonesError) throw milestonesError;
      setMilestones(milestonesData || []);
    } catch (error) {
      console.error('Error loading journey:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-6 h-6 text-success" />;
      case 'in_progress':
        return <Loader2 className="w-6 h-6 text-warning" />;
      case 'blocked':
        return <AlertCircle className="w-6 h-6 text-warning" />;
      default:
        return <Circle className="w-6 h-6 text-foreground-secondary" />;
    }
  };

  const updateMilestoneStatus = async (milestoneId: string, newStatus: 'not_started' | 'in_progress' | 'completed' | 'blocked') => {
    try {
      const { error } = await supabase
        .from('milestones')
        .update({ 
          status: newStatus,
          progress: newStatus === 'completed' ? 100 : newStatus === 'in_progress' ? 50 : 0
        })
        .eq('id', milestoneId);

      if (error) throw error;

      // Update local state
      setMilestones(prev => prev.map(m => 
        m.id === milestoneId 
          ? { ...m, status: newStatus, progress: newStatus === 'completed' ? 100 : newStatus === 'in_progress' ? 50 : 0 }
          : m
      ));

      toast({
        title: "Status atualizado",
        description: "O status do milestone foi atualizado com sucesso.",
      });

      // Recalculate journey progress
      if (selectedJourneyId) {
        loadJourneyData(selectedJourneyId);
      }
    } catch (error) {
      console.error('Error updating milestone status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success/10 border-success text-success';
      case 'in_progress':
        return 'bg-warning/10 border-warning text-warning';
      default:
        return 'bg-secondary border-secondary-foreground/20 text-secondary-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      not_started: 'Não Iniciado',
      in_progress: 'Em Progresso',
      completed: 'Concluído',
      blocked: 'Bloqueado',
    };
    return labels[status] || status;
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-display font-semibold text-foreground mb-2">
                Jornadas
              </h1>
              <p className="text-foreground-secondary">
                Selecione uma jornada para acompanhar seu progresso
              </p>
            </div>
            <Select value={selectedJourneyId} onValueChange={setSelectedJourneyId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Selecione uma jornada" />
              </SelectTrigger>
              <SelectContent>
                {journeys.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    Jornada - {j.current_phase || 'Em andamento'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                    <div className="absolute -left-16 top-1/2 -translate-y-1/2">
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
                      <Select 
                        value={milestone.status} 
                        onValueChange={(value) => updateMilestoneStatus(milestone.id, value as 'not_started' | 'in_progress' | 'completed' | 'blocked')}
                      >
                        <SelectTrigger className={`w-[180px] ${getStatusColor(milestone.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">
                            <span className="flex items-center gap-2">
                              <Circle className="w-4 h-4" />
                              Não Iniciado
                            </span>
                          </SelectItem>
                          <SelectItem value="in_progress">
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4" />
                              Em Progresso
                            </span>
                          </SelectItem>
                          <SelectItem value="completed">
                            <span className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4" />
                              Concluído
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
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
