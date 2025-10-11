import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MilestoneTemplate {
  id?: string;
  title: string;
  description: string;
  phase: string;
  order_index: number;
}

interface JourneyTemplate {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
}

const PHASES = ['Onboarding', 'Estrutura Inicial', 'Profissionalização'];

const JourneyManagement = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const [journeyTemplates, setJourneyTemplates] = useState<JourneyTemplate[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [milestones, setMilestones] = useState<MilestoneTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [newMilestone, setNewMilestone] = useState<MilestoneTemplate>({
    title: '',
    description: '',
    phase: 'Onboarding',
    order_index: 0,
  });

  const [editForm, setEditForm] = useState<MilestoneTemplate>({
    title: '',
    description: '',
    phase: 'Onboarding',
    order_index: 0,
  });

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'manager')) {
      navigate('/auth');
      return;
    }

    if (user && userRole === 'manager') {
      loadJourneyTemplates();
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    if (selectedJourneyId) {
      loadMilestones();
    }
  }, [selectedJourneyId]);

  const loadJourneyTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('journey_templates')
        .select('*')
        .order('is_default', { ascending: false });

      if (error) throw error;
      setJourneyTemplates(data || []);
      
      // Select Principal by default
      const principal = data?.find(j => j.is_default);
      if (principal) {
        setSelectedJourneyId(principal.id);
      }
    } catch (error) {
      console.error('Error loading journey templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from('milestone_templates')
        .select('*')
        .eq('journey_template_id', selectedJourneyId)
        .order('order_index');

      if (error) throw error;
      setMilestones(data || []);
    } catch (error) {
      console.error('Error loading milestones:', error);
    }
  };

  const addMilestone = async () => {
    try {
      const { error } = await supabase
        .from('milestone_templates')
        .insert({
          journey_template_id: selectedJourneyId,
          title: newMilestone.title,
          description: newMilestone.description,
          phase: newMilestone.phase,
          order_index: milestones.length + 1,
        });

      if (error) throw error;

      toast({
        title: 'Etapa adicionada',
        description: 'A nova etapa foi adicionada ao template.',
      });

      setIsAddDialogOpen(false);
      setNewMilestone({
        title: '',
        description: '',
        phase: 'Onboarding',
        order_index: 0,
      });
      loadMilestones();
    } catch (error) {
      console.error('Error adding milestone:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar a etapa.',
        variant: 'destructive',
      });
    }
  };

  const startEdit = (milestone: MilestoneTemplate) => {
    setEditingId(milestone.id || null);
    setEditForm(milestone);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      title: '',
      description: '',
      phase: 'Onboarding',
      order_index: 0,
    });
  };

  const saveEdit = async () => {
    try {
      const { error } = await supabase
        .from('milestone_templates')
        .update({
          title: editForm.title,
          description: editForm.description,
          phase: editForm.phase,
        })
        .eq('id', editingId);

      if (error) throw error;

      toast({
        title: 'Etapa atualizada',
        description: 'A etapa foi atualizada no template.',
      });

      cancelEdit();
      loadMilestones();
    } catch (error) {
      console.error('Error updating milestone:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a etapa.',
        variant: 'destructive',
      });
    }
  };

  const deleteMilestone = async (milestoneId: string) => {
    if (!confirm('Tem certeza que deseja remover esta etapa do template?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('milestone_templates')
        .delete()
        .eq('id', milestoneId);

      if (error) throw error;

      toast({
        title: 'Etapa removida',
        description: 'A etapa foi removida do template.',
      });

      loadMilestones();
    } catch (error) {
      console.error('Error deleting milestone:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a etapa.',
        variant: 'destructive',
      });
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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-display font-semibold text-foreground mb-2">
              Gerenciar Jornadas
            </h1>
            <p className="text-foreground-secondary mb-6">
              Edite os templates de jornada que podem ser aplicados aos alunos
            </p>
            
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-md">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Selecione a Jornada
                </label>
                <Select value={selectedJourneyId} onValueChange={setSelectedJourneyId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma jornada" />
                  </SelectTrigger>
                  <SelectContent>
                    {journeyTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <span>{template.name}</span>
                          {template.is_default && (
                            <Badge variant="outline" className="text-xs">Padrão</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {journeyTemplates.find(j => j.id === selectedJourneyId)?.description && (
              <p className="text-sm text-foreground-secondary mt-3 max-w-2xl">
                {journeyTemplates.find(j => j.id === selectedJourneyId)?.description}
              </p>
            )}
          </div>

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-display font-semibold text-foreground">
              Etapas da Jornada
            </h2>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar Etapa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Nova Etapa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Título
                    </label>
                    <Input
                      value={newMilestone.title}
                      onChange={(e) =>
                        setNewMilestone({ ...newMilestone, title: e.target.value })
                      }
                      placeholder="Ex: Criar conta Mercado Livre"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Descrição
                    </label>
                    <Textarea
                      value={newMilestone.description}
                      onChange={(e) =>
                        setNewMilestone({ ...newMilestone, description: e.target.value })
                      }
                      placeholder="Descreva a etapa..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Fase
                    </label>
                    <Select
                      value={newMilestone.phase}
                      onValueChange={(value) =>
                        setNewMilestone({ ...newMilestone, phase: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHASES.map((phase) => (
                          <SelectItem key={phase} value={phase}>
                            {phase}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={addMilestone} className="w-full">
                    Adicionar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {milestones.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-foreground-secondary">
                  Nenhuma etapa cadastrada para esta jornada
                </p>
              </Card>
            ) : (
              milestones.map((milestone) => (
                <Card key={milestone.id} className="p-6">
                  {editingId === milestone.id ? (
                    <div className="space-y-4">
                      <Input
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        placeholder="Título"
                      />
                      <Textarea
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm({ ...editForm, description: e.target.value })
                        }
                        placeholder="Descrição"
                      />
                      <Select
                        value={editForm.phase}
                        onValueChange={(value) => setEditForm({ ...editForm, phase: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PHASES.map((phase) => (
                            <SelectItem key={phase} value={phase}>
                              {phase}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button onClick={saveEdit} className="gap-2">
                          <Save className="w-4 h-4" />
                          Salvar
                        </Button>
                        <Button onClick={cancelEdit} variant="outline" className="gap-2">
                          <X className="w-4 h-4" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-foreground mb-2">
                            {milestone.title}
                          </h3>
                          <p className="text-foreground-secondary mb-3">
                            {milestone.description}
                          </p>
                          <Badge variant="outline">{milestone.phase}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(milestone)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMilestone(milestone.id!)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default JourneyManagement;
