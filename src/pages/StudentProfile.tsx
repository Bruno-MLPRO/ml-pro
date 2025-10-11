import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Mail, Calendar, TrendingUp } from 'lucide-react';

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
  title: string;
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
  const navigate = useNavigate();

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

      const { data: milestonesData, error: milestonesError } = await supabase
        .from('milestones')
        .select('title, status, progress, phase')
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

  if (!profile || !journey) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 ml-64">
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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 ml-64">
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
                milestones.map((milestone, index) => (
                  <div key={index} className="border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-foreground">{milestone.title}</h3>
                      <Badge variant={milestone.status === 'completed' ? 'outline' : 'default'}>
                        {milestone.status === 'completed' ? 'Concluído' : 
                         milestone.status === 'in_progress' ? 'Em Progresso' : 
                         milestone.status === 'blocked' ? 'Bloqueado' : 'Não Iniciado'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="text-xs">
                        {milestone.phase}
                      </Badge>
                      <div className="flex-1">
                        <Progress value={milestone.progress} className="h-2" />
                      </div>
                      <span className="text-sm font-semibold text-foreground-secondary">
                        {milestone.progress}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StudentProfile;
