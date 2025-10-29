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

// Interfaces removidas - usando tipos centralizados de @/types/journeys
import type { Milestone, Journey } from "@/types/journeys";

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
      // Get all journey templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('journey_templates')
        .select('*')
        .order('is_default', { ascending: false });

      if (templatesError) throw templatesError;
      
      setJourneys(templatesData || []);
      
      // Select the default journey or the first one
      if (templatesData && templatesData.length > 0) {
        const defaultJourney = templatesData.find(j => j.is_default);
        setSelectedJourneyId(defaultJourney?.id || templatesData[0].id);
      }
    } catch (error) {
      console.error('Error loading journeys:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadJourneyData = async (journeyTemplateId: string) => {
    try {
      // Get student's journey
      const { data: studentJourneyData, error: journeyError } = await supabase
        .from('student_journeys')
        .select('*')
        .eq('student_id', user!.id)
        .maybeSingle();

      if (journeyError) throw journeyError;

      // Get milestone templates from the selected journey template
      const { data: milestoneTemplatesData, error: templatesError } = await supabase
        .from('milestone_templates')
        .select('*')
        .eq('journey_template_id', journeyTemplateId)
        .order('order_index');

      if (templatesError) throw templatesError;

      // If student has a journey, get their milestone progress
      if (studentJourneyData) {
        const { data: studentMilestonesData, error: milestonesError } = await supabase
          .from('milestones')
          .select('*')
          .eq('journey_id', studentJourneyData.id)
          .order('order_index');

        if (milestonesError) throw milestonesError;

        // If student has existing milestones
        if (studentMilestonesData && studentMilestonesData.length > 0) {
          // Try to match by template_id first, then by title and phase
          const mergedMilestones = (milestoneTemplatesData || []).map((template: any) => {
            const studentMilestone = studentMilestonesData.find(
              (sm: any) => 
                sm.template_id === template.id || 
                (sm.title === template.title && sm.phase === template.phase)
            );
            
            return {
              id: studentMilestone?.id || template.id,
              title: studentMilestone?.title || template.title,
              description: studentMilestone?.description || template.description,
              phase: studentMilestone?.phase || template.phase,
              status: studentMilestone?.status || 'not_started',
              progress: studentMilestone?.progress || 0,
              order_index: studentMilestone?.order_index || template.order_index,
              isExisting: !!studentMilestone,
            };
          });
          setMilestones(mergedMilestones);
          
          // Calculate overall progress based on completed milestones
          const completedCount = mergedMilestones.filter(m => m.status === 'completed').length;
          const totalCount = mergedMilestones.length;
          const calculatedProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          
          setJourney({
            overall_progress: calculatedProgress,
            current_phase: studentJourneyData?.current_phase || 'Onboarding'
          });
        } else {
          // No milestones yet, show templates with default status
          const defaultMilestones = (milestoneTemplatesData || []).map((template: any) => ({
            id: template.id,
            title: template.title,
            description: template.description,
            phase: template.phase,
            status: 'not_started' as const,
            progress: 0,
            order_index: template.order_index,
            isExisting: false,
          }));
          setMilestones(defaultMilestones);
          
          setJourney({
            overall_progress: 0,
            current_phase: studentJourneyData?.current_phase || 'Onboarding'
          });
        }
      } else {
        // No student journey yet, just show templates with default status
        const defaultMilestones = (milestoneTemplatesData || []).map((template: any) => ({
          id: template.id,
          title: template.title,
          description: template.description,
          phase: template.phase,
          status: 'not_started' as const,
          progress: 0,
          order_index: template.order_index,
          isExisting: false,
        }));
        setMilestones(defaultMilestones);
        
        setJourney({
          overall_progress: 0,
          current_phase: 'Onboarding'
        });
      }
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
      // First, check if student has a journey
      const { data: studentJourneyData, error: journeyCheckError } = await supabase
        .from('student_journeys')
        .select('id')
        .eq('student_id', user!.id)
        .maybeSingle();

      if (journeyCheckError) throw journeyCheckError;

      let journeyId = studentJourneyData?.id;
      let actualMilestoneId = milestoneId;

      if (journeyId) {
        // Journey exists, find the milestone
        // Check if this ID is already a milestone ID
        const { data: directMilestone, error: directError } = await supabase
          .from('milestones')
          .select('id')
          .eq('id', milestoneId)
          .eq('journey_id', journeyId)
          .maybeSingle();

        if (directError) throw directError;

        if (directMilestone) {
          // It's already a milestone ID
          actualMilestoneId = directMilestone.id;
        } else {
          // It might be a template ID, try to find by template_id
          const { data: milestoneByTemplate, error: templateError } = await supabase
            .from('milestones')
            .select('id')
            .eq('journey_id', journeyId)
            .eq('template_id', milestoneId)
            .maybeSingle();

          if (templateError) throw templateError;

          if (milestoneByTemplate) {
            actualMilestoneId = milestoneByTemplate.id;
          } else {
            // Still not found - create the milestone if needed
            // Get template info
            const { data: template, error: templateInfoError } = await supabase
              .from('milestone_templates')
              .select('*')
              .eq('id', milestoneId)
              .maybeSingle();

            if (templateInfoError) throw templateInfoError;

            if (template) {
              const { data: newMilestone, error: createError } = await supabase
                .from('milestones')
                .insert([{
                  journey_id: journeyId,
                  template_id: template.id,
                  title: template.title,
                  description: template.description,
                  phase: template.phase,
                  order_index: template.order_index,
                  status: 'not_started' as const,
                  progress: 0
                }])
                .select()
                .single();

              if (createError) throw createError;
              actualMilestoneId = newMilestone.id;
            }
          }
        }
      } else {
        // No journey exists, create one
        const { data: newJourney, error: createJourneyError } = await supabase
          .from('student_journeys')
          .insert([{
            student_id: user!.id,
            current_phase: 'Onboarding',
            overall_progress: 0
          }])
          .select()
          .single();

        if (createJourneyError) throw createJourneyError;
        journeyId = newJourney.id;

        // Create all milestones from the selected template
        const { data: milestoneTemplatesData, error: templatesError } = await supabase
          .from('milestone_templates')
          .select('*')
          .eq('journey_template_id', selectedJourneyId)
          .order('order_index');

        if (templatesError) throw templatesError;

        const milestonesToCreate = (milestoneTemplatesData || []).map((template: any) => ({
          journey_id: journeyId,
          template_id: template.id,
          title: template.title,
          description: template.description,
          phase: template.phase,
          order_index: template.order_index,
          status: 'not_started' as const,
          progress: 0
        }));

        const { data: createdMilestones, error: createMilestonesError } = await supabase
          .from('milestones')
          .insert(milestonesToCreate)
          .select();

        if (createMilestonesError) throw createMilestonesError;

        // Find the actual milestone ID for the template we're updating
        const createdMilestone = createdMilestones?.find((m: any) => m.template_id === milestoneId);
        if (createdMilestone) {
          actualMilestoneId = createdMilestone.id;
        }
      }

      // Update the milestone status
      const { error } = await supabase
        .from('milestones')
        .update({ 
          status: newStatus,
          progress: newStatus === 'completed' ? 100 : newStatus === 'in_progress' ? 50 : 0,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', actualMilestoneId);

      if (error) throw error;

      // Recalculate overall progress based on completed milestones
      const { data: allMilestones, error: milestonesError } = await supabase
        .from('milestones')
        .select('status')
        .eq('journey_id', journeyId);

      if (milestonesError) throw milestonesError;

      if (allMilestones && allMilestones.length > 0) {
        const completedCount = allMilestones.filter(m => m.status === 'completed').length;
        const totalCount = allMilestones.length;
        const overallProgress = Math.round((completedCount / totalCount) * 100);

        // Update the student journey overall progress
        const { error: journeyUpdateError } = await supabase
          .from('student_journeys')
          .update({ overall_progress: overallProgress })
          .eq('id', journeyId);

        if (journeyUpdateError) throw journeyUpdateError;
      }

      toast({
        title: "Status atualizado",
        description: "O status do milestone foi atualizado com sucesso.",
      });

      // Reload journey data to get fresh state
      if (selectedJourneyId) {
        await loadJourneyData(selectedJourneyId);
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
                    Jornada - {j.name}
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
