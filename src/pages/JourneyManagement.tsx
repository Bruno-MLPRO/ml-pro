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

const PHASES = ['Onboarding', 'Estrutura Inicial', 'Profissionalização'];

const JourneyManagement = () => {
  const { user, userRole, loading: authLoading } = useAuth();
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
      loadMilestones();
    }
  }, [user, userRole, authLoading, navigate]);

  const loadMilestones = async () => {
    try {
      // Get milestones from the first student journey as template
      const { data: journeys } = await supabase
        .from('student_journeys')
        .select('id')
        .limit(1)
        .single();

      if (journeys) {
        const { data, error } = await supabase
          .from('milestones')
          .select('*')
          .eq('journey_id', journeys.id)
          .order('order_index');

        if (error) throw error;
        setMilestones(data || []);
      }
    } catch (error) {
      console.error('Error loading milestones:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMilestone = async () => {
    try {
      // Get all student journeys
      const { data: journeys, error: journeysError } = await supabase
        .from('student_journeys')
        .select('id');

      if (journeysError) throw journeysError;

      // Add milestone to all student journeys
      const milestonePromises = journeys.map((journey) =>
        supabase.from('milestones').insert({
          journey_id: journey.id,
          title: newMilestone.title,
          description: newMilestone.description,
          phase: newMilestone.phase,
          order_index: milestones.length + 1,
          status: 'not_started',
          progress: 0,
        })
      );

      await Promise.all(milestonePromises);

      toast({
        title: 'Etapa adicionada',
        description: 'A nova etapa foi adicionada para todos os alunos.',
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
      // Update all milestones with the same title (across all students)
      const { error } = await supabase
        .from('milestones')
        .update({
          title: editForm.title,
          description: editForm.description,
          phase: editForm.phase,
        })
        .eq('order_index', editForm.order_index);

      if (error) throw error;

      toast({
        title: 'Etapa atualizada',
        description: 'A etapa foi atualizada para todos os alunos.',
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

  const deleteMilestone = async (orderIndex: number) => {
    if (!confirm('Tem certeza que deseja remover esta etapa de todos os alunos?')) {
      return;
    }

    try {
      // Delete all milestones with this order_index (across all students)
      const { error } = await supabase
        .from('milestones')
        .delete()
        .eq('order_index', orderIndex);

      if (error) throw error;

      toast({
        title: 'Etapa removida',
        description: 'A etapa foi removida de todos os alunos.',
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
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-display font-semibold text-foreground mb-2">
                Gerenciar Jornada
              </h1>
              <p className="text-foreground-secondary">
                Edite as etapas que serão aplicadas a todos os alunos
              </p>
            </div>
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
            {milestones.map((milestone) => (
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
                          onClick={() => deleteMilestone(milestone.order_index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default JourneyManagement;
