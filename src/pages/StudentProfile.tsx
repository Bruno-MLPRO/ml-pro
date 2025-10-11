import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Mail, Calendar, TrendingUp, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  full_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

interface Journey {
  overall_progress: number;
  current_phase: string;
  enrollment_date: string;
  last_activity: string;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  phase: string;
}

const StudentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { user, userRole, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user && id) {
      loadStudentData();
    }
  }, [user, id, authLoading, navigate]);

  const loadStudentData = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: journeyData, error: journeyError } = await supabase
        .from('student_journeys')
        .select('*')
        .eq('student_id', id)
        .single();

      if (journeyError) throw journeyError;
      setJourney(journeyData);
      setJourneyId(journeyData.id);

      const { data: milestonesData, error: milestonesError } = await supabase
        .from('milestones')
        .select('*')
        .eq('journey_id', journeyData.id)
        .order('order_index');

      if (milestonesError) throw milestonesError;
      setMilestones(milestonesData || []);
    } catch (error) {
      console.error('Error loading student data:', error);
    } finally {
      setLoading(false);
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
      loadStudentData();
    } catch (error) {
      console.error('Error updating milestone status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
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

  if (!profile || !journey) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <Card className="p-8 text-center">
            <p className="text-foreground-secondary">Perfil não encontrado</p>
          </Card>
        </main>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <Card className="p-8 mb-8">
            <div className="flex items-start gap-6">
              <Avatar className="w-24 h-24">
                <AvatarFallback className="text-2xl font-display font-semibold">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-3xl font-display font-semibold text-foreground mb-2">
                  {profile.full_name}
                </h1>
                <div className="flex items-center gap-4 text-foreground-secondary mb-4">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>{profile.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Desde {new Date(journey.enrollment_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-sm">
                    {journey.current_phase || 'Sem fase definida'}
                  </Badge>
                  <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                    <TrendingUp className="w-4 h-4" />
                    <span>
                      Última atividade: {new Date(journey.last_activity).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-8 mb-8">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              Progresso Geral
            </h2>
            <div className="flex items-center gap-4 mb-2">
              <Progress value={journey.overall_progress} className="flex-1 h-4" />
              <span className="text-2xl font-bold text-primary">
                {journey.overall_progress}%
              </span>
            </div>
          </Card>

          <Card className="p-8">
            <h2 className="text-xl font-display font-semibold text-foreground mb-6">
              Etapas da Jornada
            </h2>
            <div className="space-y-4">
              {milestones.length === 0 ? (
                <p className="text-center text-foreground-secondary py-8">
                  Nenhuma etapa cadastrada
                </p>
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
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StudentProfile;
