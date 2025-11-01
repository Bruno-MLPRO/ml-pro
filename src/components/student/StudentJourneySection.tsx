import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Milestone } from "@/types/journeys";
import type { JourneyTemplate } from "@/types/journeys";

interface StudentJourneySectionProps {
  studentId: string;
  journeyId: string | null;
  journeyTemplates: JourneyTemplate[];
}

export function StudentJourneySection({
  studentId,
  journeyId,
  journeyTemplates
}: StudentJourneySectionProps) {
  const { toast } = useToast();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedJourneyTemplateId, setSelectedJourneyTemplateId] = useState<string>("");
  const [phases, setPhases] = useState<string[]>([]);

  useEffect(() => {
    if (journeyTemplates.length > 0 && !selectedJourneyTemplateId) {
      const defaultTemplate = journeyTemplates.find(t => t.is_default) || journeyTemplates[0];
      if (defaultTemplate) {
        setSelectedJourneyTemplateId(defaultTemplate.id);
        if (journeyId) {
          loadMilestonesByTemplate(journeyId, defaultTemplate.id);
        }
      }
    }
  }, [journeyTemplates, journeyId]);

  const loadMilestonesByTemplate = async (journeyId: string, templateId: string) => {
    try {
      const { data: mtemps, error: mtError } = await supabase
        .from('milestone_templates')
        .select('id, phase')
        .eq('journey_template_id', templateId);

      if (mtError) throw mtError;
      
      const templateIds = (mtemps || []).map(t => t.id);
      
      // Extrair fases únicas dos milestone templates
      const uniquePhases = [...new Set((mtemps || []).map(t => t.phase))].filter(Boolean);
      setPhases(uniquePhases);
      
      let query = supabase
        .from('milestones')
        .select('*')
        .eq('journey_id', journeyId);
      
      if (templateIds.length > 0) {
        query = query.or(`template_id.in.(${templateIds.join(',')}),template_id.is.null`);
      }
      
      const { data: milestonesData, error: mError } = await query.order('order_index');

      if (mError) throw mError;
      setMilestones(milestonesData || []);
    } catch (error: any) {
      console.error('Error loading milestones by template:', error);
      setMilestones([]);
      setPhases([]);
    }
  };

  const updateMilestoneStatus = async (milestoneId: string, newStatus: string) => {
    const updateData: any = { status: newStatus };
    
    if (newStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('milestones')
      .update(updateData)
      .eq('id', milestoneId);
    
    if (error) {
      toast({ 
        title: "Erro ao atualizar etapa", 
        description: error.message,
        variant: "destructive" 
      });
      return;
    }
    
    toast({ title: "Etapa atualizada com sucesso!" });
    if (journeyId && selectedJourneyTemplateId) {
      loadMilestonesByTemplate(journeyId, selectedJourneyTemplateId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Jornada do Aluno</CardTitle>
          {journeyTemplates.length > 0 && journeyId && (
            <Select value={selectedJourneyTemplateId} onValueChange={(value) => {
              setSelectedJourneyTemplateId(value);
              if (journeyId) {
                loadMilestonesByTemplate(journeyId, value);
              }
            }}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione a jornada" />
              </SelectTrigger>
              <SelectContent>
                {journeyTemplates.map(tpl => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {milestones.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma etapa cadastrada</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Agrupar por fase - DINÂMICO do banco de dados */}
            {phases.map(phase => {
              const phaseMilestones = milestones.filter(m => m.phase === phase);
              if (phaseMilestones.length === 0) return null;

              const completed = phaseMilestones.filter(m => m.status === 'completed').length;
              const progress = (completed / phaseMilestones.length) * 100;

              return (
                <div key={phase} className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{phase}</h4>
                      <span className="text-sm text-muted-foreground">
                        {completed}/{phaseMilestones.length} completas
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  
                  <div className="space-y-2 pl-4">
                    {phaseMilestones.map(milestone => (
                      <div 
                        key={milestone.id} 
                        className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {milestone.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                          ) : milestone.status === 'in_progress' ? (
                            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-sm">{milestone.title}</p>
                            {milestone.description && (
                              <p className="text-xs text-muted-foreground">{milestone.description}</p>
                            )}
                          </div>
                        </div>
                        <Select 
                          value={milestone.status} 
                          onValueChange={(value) => updateMilestoneStatus(milestone.id, value)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_started">Não Iniciada</SelectItem>
                            <SelectItem value="in_progress">Em Progresso</SelectItem>
                            <SelectItem value="completed">Concluída</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


