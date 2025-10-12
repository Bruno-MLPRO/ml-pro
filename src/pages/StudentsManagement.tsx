import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Pencil, Trash2, ExternalLink, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Student {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  turma: string;
  estrutura_vendedor: string;
  tipo_pj: string | null;
  possui_contador: boolean;
  caixa: number | null;
  hub_logistico: string;
  sistemas_externos: string;
  mentoria_status: string;
  current_phase?: string;
  overall_progress?: number;
}

interface Plan {
  id: string;
  name: string;
  price: number;
}

interface JourneyTemplate {
  id: string;
  name: string;
  is_default: boolean;
}

interface StudentWithJourney extends Student {
  journey_progress?: Record<string, number>;
  in_progress_milestones?: Record<string, Array<{ title: string }>>;
  milestones_status?: Record<string, 'not_started' | 'in_progress' | 'completed'>;
  student_apps?: Array<{ id: string; name: string; color: string }>;
}

const DEFAULT_PASSWORD = "12345678";

export default function StudentsManagement() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentWithJourney[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [journeyTemplates, setJourneyTemplates] = useState<JourneyTemplate[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Ativo");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDetailsDialogOpen, setIsViewDetailsDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedStudentMilestones, setSelectedStudentMilestones] = useState<any[]>([]);
  const [dialogJourneyId, setDialogJourneyId] = useState<string>("");
  const [studentApps, setStudentApps] = useState<any[]>([]);
  const [availableApps, setAvailableApps] = useState<any[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    turma: "",
    estado: "",
    estrutura_vendedor: "CPF",
    tipo_pj: "",
    cnpj: "",
    possui_contador: false,
    caixa: "",
    hub_logistico: "Pretendo usar",
    sistemas_externos: "",
    mentoria_status: "Ativo",
  });

  const estadosBrasil = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'manager')) {
      navigate('/auth');
      return;
    }

    if (user && userRole === 'manager') {
      fetchJourneyTemplates();
      fetchStudents();
      fetchPlans();

      // Set up realtime subscription for profile updates
      const channel = supabase
        .channel('profiles-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles'
          },
          () => {
            // Reload students when any profile changes
            fetchStudents();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, userRole, authLoading, navigate]);

  const fetchJourneyTemplates = async () => {
    const { data, error } = await supabase
      .from("journey_templates")
      .select("*")
      .order("is_default", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar jornadas",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setJourneyTemplates(data || []);
    
    // Set default journey as selected
    const defaultJourney = data?.find(j => j.is_default);
    if (defaultJourney) {
      setSelectedJourneyId(defaultJourney.id);
    } else if (data && data.length > 0) {
      setSelectedJourneyId(data[0].id);
    }
  };

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Erro ao carregar turmas",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setPlans(data || []);
  };

  const fetchStudents = async () => {
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "student");

    if (!rolesData) return;

    const studentIds = rolesData.map((r) => r.user_id);

    const { data: profilesData, error } = await supabase
      .from("profiles")
      .select("*")
      .in("id", studentIds);

    if (error) {
      toast({
        title: "Erro ao carregar alunos",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Fetch journey data for each student
    const { data: journeysData } = await supabase
      .from("student_journeys")
      .select("id, student_id, current_phase")
      .in("student_id", studentIds);

    // Fetch all milestones for these students
    const journeyIds = journeysData?.map(j => j.id) || [];

    // Fetch all student apps with app details
    const { data: studentAppsData } = await supabase
      .from("student_apps")
      .select("student_id, apps_extensions(id, name, color)")
      .in("student_id", studentIds);

    if (journeyIds.length === 0) {
      setStudents(profilesData || []);
      return;
    }

    const { data: milestonesData } = await supabase
      .from("milestones")
      .select("journey_id, template_id, status, title")
      .in("journey_id", journeyIds);

    // Get all milestone templates to organize by journey template
    const { data: templatesData } = await supabase
      .from("milestone_templates")
      .select("id, journey_template_id");

    // Get all journey templates for calculation
    const { data: allJourneyTemplates } = await supabase
      .from("journey_templates")
      .select("*");

    // Calculate progress per journey template for each student
    const studentsWithProgress = profilesData?.map(profile => {
      const journey = journeysData?.find(j => j.student_id === profile.id);
      const studentMilestones = milestonesData?.filter(
        m => m.journey_id === journey?.id
      ) || [];

      // Group milestones by journey template
      const progressByTemplate: Record<string, number> = {};
      const inProgressByTemplate: Record<string, Array<{ title: string }>> = {};
      const statusByTemplate: Record<string, 'not_started' | 'in_progress' | 'completed'> = {};
      
      allJourneyTemplates?.forEach(template => {
        // For milestones with template_id, match by template
        const milestonesWithTemplate = studentMilestones.filter(m => {
          if (!m.template_id) return false;
          const milestoneTemplate = templatesData?.find(t => t.id === m.template_id);
          return milestoneTemplate?.journey_template_id === template.id;
        });

        // For milestones without template_id (legacy), assign to default journey if it's the default template
        let templateMilestones = milestonesWithTemplate;
        
        if (template.is_default) {
          const milestonesWithoutTemplate = studentMilestones.filter(m => !m.template_id);
          templateMilestones = [...milestonesWithTemplate, ...milestonesWithoutTemplate];
        }

        const totalMilestones = templateMilestones.length;
        const completedMilestones = templateMilestones.filter(
          m => m.status === 'completed'
        ).length;

        const progress = totalMilestones > 0
          ? Math.round((completedMilestones / totalMilestones) * 100)
          : 0;

        progressByTemplate[template.id] = progress;

        // Get in-progress milestones for this template
        const inProgress = templateMilestones.filter(m => m.status === 'in_progress');
        inProgressByTemplate[template.id] = inProgress.map(m => ({ title: m.title }));

        // Determine status for this template
        const allCompleted = totalMilestones > 0 && templateMilestones.every(m => m.status === 'completed');
        const noneStarted = totalMilestones === 0 || templateMilestones.every(m => m.status === 'not_started');
        const status = allCompleted ? 'completed' : noneStarted ? 'not_started' : 'in_progress';
        statusByTemplate[template.id] = status;
      });

      // Get student apps
      const studentApps = studentAppsData?.filter(sa => sa.student_id === profile.id)
        .map(sa => sa.apps_extensions)
        .flat()
        .filter(Boolean) || [];

      return {
        ...profile,
        current_phase: journey?.current_phase || "Onboarding",
        journey_progress: progressByTemplate,
        in_progress_milestones: inProgressByTemplate,
        milestones_status: statusByTemplate,
        student_apps: studentApps
      };
    }) || [];

    setStudents(studentsWithProgress);
  };

  const handleCreateStudent = async () => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: DEFAULT_PASSWORD,
      options: {
        data: {
          full_name: formData.full_name,
          role: "student",
        },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (authError) {
      toast({
        title: "Erro ao criar aluno",
        description: authError.message,
        variant: "destructive",
      });
      return;
    }

    if (authData.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          phone: formData.phone,
          turma: formData.turma,
          estado: formData.estado,
          estrutura_vendedor: formData.estrutura_vendedor,
          tipo_pj: formData.estrutura_vendedor === "PJ" ? formData.tipo_pj : null,
          cnpj: formData.estrutura_vendedor === "PJ" ? formData.cnpj : null,
          possui_contador: formData.possui_contador,
          caixa: formData.caixa ? parseFloat(formData.caixa) : null,
          hub_logistico: formData.hub_logistico,
          sistemas_externos: formData.sistemas_externos,
          mentoria_status: formData.mentoria_status,
        })
        .eq("id", authData.user.id);

      if (profileError) {
        toast({
          title: "Erro ao atualizar perfil",
          description: profileError.message,
          variant: "destructive",
        });
        return;
      }
    }

    toast({
      title: "Aluno criado com sucesso",
      description: `Senha padrão: ${DEFAULT_PASSWORD}`,
    });

    setIsCreateDialogOpen(false);
    resetForm();
    fetchStudents();
  };

  const handleUpdateStudent = async () => {
    if (!selectedStudent) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: formData.full_name,
        phone: formData.phone,
        turma: formData.turma,
        estado: formData.estado,
        estrutura_vendedor: formData.estrutura_vendedor,
        tipo_pj: formData.estrutura_vendedor === "PJ" ? formData.tipo_pj : null,
        cnpj: formData.estrutura_vendedor === "PJ" ? formData.cnpj : null,
        possui_contador: formData.possui_contador,
        caixa: formData.caixa ? parseFloat(formData.caixa) : null,
        hub_logistico: formData.hub_logistico,
        sistemas_externos: formData.sistemas_externos,
        mentoria_status: formData.mentoria_status,
      })
      .eq("id", selectedStudent.id);

    if (error) {
      toast({
        title: "Erro ao atualizar aluno",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Aluno atualizado com sucesso",
    });

    setIsEditDialogOpen(false);
    resetForm();
    
    // Recarrega os dados e reabre o dialog com dados atualizados
    await fetchStudents();
    
    // Busca os dados atualizados do aluno
    const { data: updatedStudent } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", selectedStudent.id)
      .single();
    
    if (updatedStudent) {
      // Reabre o dialog com os dados atualizados
      await openViewDetailsDialog(updatedStudent);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm("Tem certeza que deseja excluir este aluno? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      // Delete from student_journeys first (removes manager assignment)
      const { error: journeyError } = await supabase
        .from("student_journeys")
        .delete()
        .eq("student_id", studentId);

      if (journeyError) throw journeyError;

      // Delete from user_roles
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", studentId);

      if (roleError) throw roleError;

      // Delete from profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", studentId);

      if (profileError) throw profileError;

      toast({
        title: "Aluno excluído com sucesso",
        description: "O aluno foi removido do sistema",
      });

      fetchStudents();
    } catch (error: any) {
      console.error('Error deleting student:', error);
      toast({
        title: "Erro ao excluir aluno",
        description: error.message || "Não foi possível excluir o aluno",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (student: Student) => {
    setSelectedStudent(student);
    setFormData({
      full_name: student.full_name,
      email: student.email,
      phone: student.phone || "",
      turma: student.turma || "",
      estado: (student as any).estado || "",
      estrutura_vendedor: student.estrutura_vendedor || "CPF",
      tipo_pj: student.tipo_pj || "",
      cnpj: (student as any).cnpj || "",
      possui_contador: student.possui_contador ?? false,
      caixa: student.caixa?.toString() || "",
      hub_logistico: student.hub_logistico || "Pretendo usar",
      sistemas_externos: student.sistemas_externos || "",
      mentoria_status: student.mentoria_status || "Ativo",
    });
    setIsEditDialogOpen(true);
  };

  const fetchStudentApps = async (studentId: string) => {
    const { data, error } = await supabase
      .from("student_apps")
      .select("*, apps_extensions(*)")
      .eq("student_id", studentId);

    if (error) {
      toast({
        title: "Erro ao carregar apps",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setStudentApps(data || []);
  };

  const fetchAvailableApps = async () => {
    const { data, error } = await supabase
      .from("apps_extensions")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Erro ao carregar apps disponíveis",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setAvailableApps(data || []);
  };

  const handleAddAppToStudent = async (appId: string) => {
    if (!selectedStudent) return;

    const { error } = await supabase
      .from("student_apps")
      .insert({
        student_id: selectedStudent.id,
        app_id: appId,
      });

    if (error) {
      toast({
        title: "Erro ao adicionar app",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "App adicionado com sucesso",
    });

    fetchStudentApps(selectedStudent.id);
  };

  const handleRemoveAppFromStudent = async (studentAppId: string) => {
    const { error } = await supabase
      .from("student_apps")
      .delete()
      .eq("id", studentAppId);

    if (error) {
      toast({
        title: "Erro ao remover app",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "App removido com sucesso",
    });

    if (selectedStudent) {
      fetchStudentApps(selectedStudent.id);
    }
  };

  const fetchMilestonesForJourney = async (studentId: string, journeyTemplateId: string) => {
    // Fetch student's journey
    const { data: journeyData } = await supabase
      .from("student_journeys")
      .select("id")
      .eq("student_id", studentId)
      .single();

    if (!journeyData) return;

    // Fetch milestones for selected journey template
    const { data: milestones } = await supabase
      .from("milestones")
      .select("*, milestone_templates!milestones_template_id_fkey(journey_template_id)")
      .eq("journey_id", journeyData.id)
      .order("order_index");

    // Filter milestones by selected journey template
    const filteredMilestones = milestones?.filter(m => {
      if (!m.template_id) {
        // Legacy milestones without template - show for default journey
        const defaultTemplate = journeyTemplates.find(t => t.is_default);
        return journeyTemplateId === defaultTemplate?.id;
      }
      const template = m.milestone_templates as any;
      return template?.journey_template_id === journeyTemplateId;
    }) || [];

    setSelectedStudentMilestones(filteredMilestones);
  };

  const openViewDetailsDialog = async (student: Student) => {
    setSelectedStudent(student);
    setDialogJourneyId(selectedJourneyId);
    
    // Fetch student's journey
    const { data: journeyData } = await supabase
      .from("student_journeys")
      .select("id")
      .eq("student_id", student.id)
      .single();

    if (!journeyData) {
      toast({
        title: "Erro",
        description: "Jornada do aluno não encontrada",
        variant: "destructive",
      });
      return;
    }

    // Fetch apps, available apps, and milestones
    await Promise.all([
      fetchStudentApps(student.id),
      fetchAvailableApps(),
      fetchMilestonesForJourney(student.id, selectedJourneyId)
    ]);

    setIsViewDetailsDialogOpen(true);
  };

  const handleUpdateMilestoneStatus = async (milestoneId: string, newStatus: string) => {
    const updateData: any = { status: newStatus };
    
    if (newStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    const { error } = await supabase
      .from("milestones")
      .update(updateData)
      .eq("id", milestoneId);

    if (error) {
      toast({
        title: "Erro ao atualizar etapa",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Update local state
    setSelectedStudentMilestones(prev =>
      prev.map(m => m.id === milestoneId ? { ...m, ...updateData } : m)
    );

    // Refresh students to update progress
    fetchStudents();

    toast({
      title: "Etapa atualizada com sucesso",
    });
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      turma: "",
      estado: "",
      estrutura_vendedor: "CPF",
      tipo_pj: "",
      cnpj: "",
      possui_contador: false,
      caixa: "",
      hub_logistico: "Pretendo usar",
      sistemas_externos: "",
      mentoria_status: "Ativo",
    });
    setSelectedStudent(null);
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "Todos" ||
      (statusFilter === "Ativo" && student.mentoria_status === "Ativo") ||
      (statusFilter === "Inativo" && student.mentoria_status === "Inativo");
    
    return matchesSearch && matchesStatus;
  });

  const StudentForm = () => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="full_name">Nome Completo</Label>
        <Input
          id="full_name"
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          disabled={isEditDialogOpen}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="phone">Telefone</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="turma">Turma ML PRO</Label>
        <Select value={formData.turma} onValueChange={(value) => setFormData({ ...formData, turma: value })}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Selecione a turma" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {plans.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                Nenhuma turma cadastrada
              </div>
            ) : (
              plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.name}>
                  {plan.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="estado">Localização (Estado)</Label>
        <Select value={formData.estado} onValueChange={(value) => setFormData({ ...formData, estado: value })}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Selecione o estado" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {estadosBrasil.map((estado) => (
              <SelectItem key={estado} value={estado}>
                {estado}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="estrutura">Estrutura do Vendedor</Label>
        <Select
          value={formData.estrutura_vendedor}
          onValueChange={(value) =>
            setFormData({ ...formData, estrutura_vendedor: value, tipo_pj: value === "CPF" ? "" : formData.tipo_pj })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CPF">Pessoa Física (CPF)</SelectItem>
            <SelectItem value="PJ">Pessoa Jurídica (PJ)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.estrutura_vendedor === "PJ" && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="tipo_pj">Tipo de PJ</Label>
            <Select value={formData.tipo_pj} onValueChange={(value) => setFormData({ ...formData, tipo_pj: value })}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="MEI">MEI</SelectItem>
                <SelectItem value="ME">ME</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {formData.tipo_pj && (
            <div className="grid gap-2">
              <Label htmlFor="cnpj">Número do CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
          )}
        </>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="contador"
          checked={formData.possui_contador}
          onCheckedChange={(checked) => setFormData({ ...formData, possui_contador: checked === true })}
        />
        <Label htmlFor="contador" className="cursor-pointer">
          Possui Contador
        </Label>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="caixa">Caixa (Capital de Giro)</Label>
        <Input
          id="caixa"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={formData.caixa}
          onChange={(e) => setFormData({ ...formData, caixa: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="hub_logistico">Hub Logístico (Centralize)</Label>
        <Select value={formData.hub_logistico} onValueChange={(value) => setFormData({ ...formData, hub_logistico: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Pretendo usar">Pretendo usar</SelectItem>
            <SelectItem value="Já uso">Já uso</SelectItem>
            <SelectItem value="Não vou usar">Não vou usar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="sistemas">Sistemas Externos</Label>
        <Input
          id="sistemas"
          placeholder="Ex: Olist, Tiny, etc."
          value={formData.sistemas_externos}
          onChange={(e) => setFormData({ ...formData, sistemas_externos: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="mentoria_status">Status da Mentoria</Label>
        <Select value={formData.mentoria_status} onValueChange={(value) => setFormData({ ...formData, mentoria_status: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Ativo">Ativo</SelectItem>
            <SelectItem value="Inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case "Onboarding":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Estrutura Inicial":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "Profissionalização":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Gerenciamento de Alunos</h1>
          <p className="text-muted-foreground">Gerencie os alunos da plataforma</p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="list">Lista</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter" className="text-sm">Filtrar por:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Apenas ativos</SelectItem>
                    <SelectItem value="Inativo">Apenas inativos</SelectItem>
                    <SelectItem value="Todos">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Label htmlFor="journey-filter" className="text-sm">Jornada:</Label>
                <Select value={selectedJourneyId} onValueChange={setSelectedJourneyId}>
                  <SelectTrigger id="journey-filter" className="w-[200px]">
                    <SelectValue placeholder="Selecione a jornada" />
                  </SelectTrigger>
                  <SelectContent>
                    {journeyTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudents.map((student) => {
                const journeyProgress = student.journey_progress?.[selectedJourneyId] || 0;
                const inProgressMilestones = student.in_progress_milestones?.[selectedJourneyId] || [];
                const milestonesStatus = student.milestones_status?.[selectedJourneyId] || 'not_started';
                
                return (
                  <Card key={student.id} className="hover:shadow-xl transition-all duration-200 border-border/50 flex flex-col h-full">
                    <CardHeader className="space-y-3 pb-4 flex-shrink-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-xl font-bold mb-1 truncate">{student.full_name}</CardTitle>
                          <CardDescription className="text-sm">{student.turma || "Sem turma"}</CardDescription>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                            student.mentoria_status === "Ativo"
                              ? "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400"
                              : "bg-gray-500/10 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400"
                          }`}
                        >
                          {student.mentoria_status || "Ativo"}
                        </span>
                      </div>
                      
                      {/* Apps e Extensões */}
                      {student.student_apps && student.student_apps.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {student.student_apps.map((app: any) => (
                            <div
                              key={app.id}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
                              style={{ 
                                backgroundColor: `${app.color}15`,
                                color: app.color
                              }}
                            >
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: app.color || "#3B82F6" }}
                              />
                              <span>{app.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardHeader>
                    
                    <CardContent className="space-y-4 pt-0 flex flex-col flex-1">
                      {/* Área expansível */}
                      <div className="flex-1 space-y-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Etapa em andamento:</p>
                          {milestonesStatus === 'completed' ? (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                              Concluído
                            </span>
                          ) : milestonesStatus === 'not_started' ? (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400">
                              Não iniciado
                            </span>
                          ) : inProgressMilestones.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {inProgressMilestones.slice(0, 2).map((milestone, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 truncate"
                                >
                                  {milestone.title}
                                </span>
                              ))}
                              {inProgressMilestones.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{inProgressMilestones.length - 2} mais
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400">
                              Não iniciado
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Área fixa no fundo */}
                      <div className="flex-shrink-0 space-y-4 pt-2">
                        {/* Alerta para ME sem contador */}
                        {student.tipo_pj === "ME" && !student.possui_contador && (
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <span className="text-yellow-600 dark:text-yellow-400 text-xs leading-relaxed">
                              ⚠️ Aluno ME sem contador cadastrado
                            </span>
                          </div>
                        )}
                        
                        <div>
                          <div className="flex justify-between items-center mb-2.5">
                            <p className="text-xs font-medium text-muted-foreground">Progresso da Jornada:</p>
                            <span className="text-sm font-bold">{journeyProgress}%</span>
                          </div>
                          <div className="w-full bg-muted/50 rounded-full h-2.5 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-primary to-primary/80 rounded-full h-2.5 transition-all duration-500 ease-out"
                              style={{ width: `${journeyProgress}%` }}
                            />
                          </div>
                        </div>
                        
                        <Button 
                          variant="secondary" 
                          size="default"
                          onClick={() => openViewDetailsDialog(student)}
                          className="w-full font-semibold"
                        >
                          Visualizar Detalhes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="list" className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar aluno..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Aluno
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Criar Novo Aluno</DialogTitle>
                    <DialogDescription>Preencha os dados do aluno. Senha padrão: {DEFAULT_PASSWORD}</DialogDescription>
                  </DialogHeader>
                  <StudentForm />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateStudent}>Criar Aluno</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{student.phone || "-"}</TableCell>
                      <TableCell>{student.turma || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPhaseColor(
                            student.current_phase || "Onboarding"
                          )}`}
                        >
                          {student.current_phase || "Onboarding"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            student.mentoria_status === "Ativo"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                          }`}
                        >
                          {student.mentoria_status || "Ativo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(student)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteStudent(student.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Aluno</DialogTitle>
              <DialogDescription>Atualize os dados do aluno</DialogDescription>
            </DialogHeader>
            <StudentForm />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateStudent}>Salvar Alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isViewDetailsDialogOpen} onOpenChange={setIsViewDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Detalhes de {selectedStudent?.full_name}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Seção 1: Informações do Aluno */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Informações do Aluno</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        openEditDialog(selectedStudent!);
                        setIsViewDetailsDialogOpen(false);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Nome completo</Label>
                    <p className="text-sm font-medium">{selectedStudent?.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="text-sm font-medium">{selectedStudent?.email}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Telefone</Label>
                    <p className="text-sm font-medium">{selectedStudent?.phone || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Turma ML PRO</Label>
                    <p className="text-sm font-medium">{selectedStudent?.turma || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Estado</Label>
                    <p className="text-sm font-medium">{(selectedStudent as any)?.estado || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Estrutura do vendedor</Label>
                    <p className="text-sm font-medium">{selectedStudent?.estrutura_vendedor || "-"}</p>
                  </div>
                  {selectedStudent?.estrutura_vendedor === "PJ" && (
                    <>
                      <div>
                        <Label className="text-xs text-muted-foreground">Tipo de PJ</Label>
                        <p className="text-sm font-medium">{selectedStudent?.tipo_pj || "-"}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">CNPJ</Label>
                        <p className="text-sm font-medium">{(selectedStudent as any)?.cnpj || "-"}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Possui contador</Label>
                    <p className="text-sm font-medium">{selectedStudent?.possui_contador ? "Sim" : "Não"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Caixa (Capital de Giro)</Label>
                    <p className="text-sm font-medium">
                      {selectedStudent?.caixa 
                        ? `R$ ${Number(selectedStudent.caixa).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "-"
                      }
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Hub Logístico</Label>
                    <p className="text-sm font-medium">{selectedStudent?.hub_logistico || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sistemas Externos</Label>
                    <p className="text-sm font-medium">{selectedStudent?.sistemas_externos || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status da Mentoria</Label>
                    <p className="text-sm font-medium">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          selectedStudent?.mentoria_status === "Ativo"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                        }`}
                      >
                        {selectedStudent?.mentoria_status || "Ativo"}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Seção 2: Apps e Extensões */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Apps e Extensões</h3>
                  <Select onValueChange={handleAddAppToStudent}>
                    <SelectTrigger className="w-[200px] bg-background">
                      <SelectValue placeholder="+ Adicionar App" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {availableApps
                        .filter(app => !studentApps.some(sa => sa.app_id === app.id))
                        .map(app => (
                          <SelectItem key={app.id} value={app.id}>
                            {app.name}
                          </SelectItem>
                        ))
                      }
                      {availableApps.filter(app => !studentApps.some(sa => sa.app_id === app.id)).length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Todos os apps já foram adicionados
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {studentApps.length === 0 ? (
                    <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
                      Nenhum app ou extensão cadastrado
                    </p>
                  ) : (
                    studentApps.map((studentApp) => {
                      const app = studentApp.apps_extensions;
                      return (
                        <div
                          key={studentApp.id}
                          className="flex items-start gap-3 p-3 border rounded-lg bg-card"
                        >
                          <div
                            className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: app.color || "#3B82F6" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium text-sm">{app.name}</h4>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={() => handleRemoveAppFromStudent(studentApp.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            {app.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {app.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {app.url && (
                                <a
                                  href={app.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  Link <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {app.price && (
                                <span className="text-xs text-muted-foreground">
                                  R$ {Number(app.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês
                                </span>
                              )}
                              {app.coupon && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                                  {app.coupon}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Seção 3: Jornada */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Jornada</h3>
                  <Select 
                    value={dialogJourneyId} 
                    onValueChange={(value) => {
                      setDialogJourneyId(value);
                      if (selectedStudent) {
                        fetchMilestonesForJourney(selectedStudent.id, value);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[200px] bg-background">
                      <SelectValue placeholder="Selecione a jornada" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {journeyTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  {selectedStudentMilestones.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma etapa encontrada para esta jornada
                    </p>
                  ) : (
                    selectedStudentMilestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <h4 className="font-medium mb-1">{milestone.title}</h4>
                          {milestone.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {milestone.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`status-${milestone.id}`} className="text-xs">
                              Status:
                            </Label>
                            <Select
                              value={milestone.status}
                              onValueChange={(value) => handleUpdateMilestoneStatus(milestone.id, value)}
                            >
                              <SelectTrigger id={`status-${milestone.id}`} className="w-[180px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="not_started">Não iniciado</SelectItem>
                                <SelectItem value="in_progress">Em progresso</SelectItem>
                                <SelectItem value="completed">Concluído</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              milestone.status === 'completed'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : milestone.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                            }`}
                          >
                            {milestone.status === 'completed' ? 'Concluído' : 
                             milestone.status === 'in_progress' ? 'Em progresso' : 
                             'Não iniciado'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setIsViewDetailsDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
