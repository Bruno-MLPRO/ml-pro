import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Manager {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  active_students: number;
  inactive_students: number;
}

interface Student {
  id: string;
  full_name: string;
  email: string;
  journey_id: string;
}

export default function TeamManagement() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });

  useEffect(() => {
    if (!authLoading && (!user || (userRole !== 'manager' && userRole !== 'administrator'))) {
      navigate('/auth');
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    if (user && (userRole === 'manager' || userRole === 'administrator')) {
      loadManagers();
      loadStudents();
    }
  }, [user, userRole]);

  const loadStudents = async () => {
    try {
      // Get all students with their journey info
      const { data: journeys, error } = await supabase
        .from('student_journeys')
        .select(`
          id,
          student_id,
          profiles!student_journeys_student_id_fkey(id, full_name, email)
        `);

      if (error) throw error;

      // Filter out students without valid profiles (deleted students)
      const studentsData = journeys
        ?.filter((journey: any) => journey.profiles !== null)
        .map((journey: any) => ({
          id: journey.profiles.id,
          full_name: journey.profiles.full_name,
          email: journey.profiles.email,
          journey_id: journey.id,
        })) || [];

      setStudents(studentsData);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadManagers = async () => {
    try {
      setLoading(true);
      
      // Get all managers from user_roles
      const { data: managerRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'manager');

      if (rolesError) throw rolesError;

      if (!managerRoles || managerRoles.length === 0) {
        setManagers([]);
        return;
      }

      const managerIds = managerRoles.map(r => r.user_id);

      // Get profiles for these managers
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .in('id', managerIds);

      if (profilesError) throw profilesError;

      // Get student counts for each manager
      const managersWithStats = await Promise.all(
        profiles.map(async (profile) => {
          // Get all students assigned to this manager
          const { data: journeys } = await supabase
            .from('student_journeys')
            .select(`
              student_id,
              profiles!student_journeys_student_id_fkey(mentoria_status)
            `)
            .eq('manager_id', profile.id);

          // Count active and inactive students
          const activeStudents = journeys?.filter(
            (j: any) => j.profiles?.mentoria_status === 'Ativo'
          ).length || 0;
          
          const inactiveStudents = journeys?.filter(
            (j: any) => j.profiles?.mentoria_status !== 'Ativo'
          ).length || 0;

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            phone: profile.phone,
            active_students: activeStudents,
            inactive_students: inactiveStudents,
          };
        })
      );

      setManagers(managersWithStats);
    } catch (error) {
      console.error('Error loading managers:', error);
      toast.error('Erro ao carregar gestores');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManager = async () => {
    try {
      if (!formData.full_name || !formData.email || !formData.password) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            role: 'manager'
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Update profile with phone
        await supabase
          .from('profiles')
          .update({ phone: formData.phone })
          .eq('id', authData.user.id);

        // Assign students to this manager
        if (selectedStudentIds.length > 0) {
          const updates = selectedStudentIds.map(studentId => {
            const student = students.find(s => s.id === studentId);
            return supabase
              .from('student_journeys')
              .update({ manager_id: authData.user!.id })
              .eq('id', student!.journey_id);
          });

          await Promise.all(updates);
        }
      }

      toast.success('Gestor criado com sucesso');
      setIsCreateDialogOpen(false);
      setFormData({ full_name: "", email: "", phone: "", password: "" });
      setSelectedStudentIds([]);
      loadManagers();
    } catch (error: any) {
      console.error('Error creating manager:', error);
      toast.error(error.message || 'Erro ao criar gestor');
    }
  };

  const handleEditManager = async () => {
    if (!selectedManager) return;

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
        })
        .eq('id', selectedManager.id);

      if (profileError) throw profileError;

      // Update email in auth if it changed
      if (formData.email !== selectedManager.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        });

        if (emailError) throw emailError;
      }

      // First, remove this manager from all students
      await supabase
        .from('student_journeys')
        .update({ manager_id: null })
        .eq('manager_id', selectedManager.id);

      // Then assign selected students to this manager
      if (selectedStudentIds.length > 0) {
        const updates = selectedStudentIds.map(studentId => {
          const student = students.find(s => s.id === studentId);
          return supabase
            .from('student_journeys')
            .update({ manager_id: selectedManager.id })
            .eq('id', student!.journey_id);
        });

        await Promise.all(updates);
      }

      toast.success('Gestor atualizado com sucesso');
      setIsEditDialogOpen(false);
      setSelectedManager(null);
      setFormData({ full_name: "", email: "", phone: "", password: "" });
      setSelectedStudentIds([]);
      loadManagers();
    } catch (error: any) {
      console.error('Error updating manager:', error);
      toast.error(error.message || 'Erro ao atualizar gestor');
    }
  };

  const handleDeleteManager = async () => {
    if (!selectedManager) return;

    try {
      // Remove manager assignment from all their students
      await supabase
        .from('student_journeys')
        .update({ manager_id: null })
        .eq('manager_id', selectedManager.id);

      toast.success('Vínculo com alunos removido. Gestor desvinculado com sucesso.');
      setIsDeleteDialogOpen(false);
      setSelectedManager(null);
      loadManagers();
    } catch (error) {
      console.error('Error deleting manager:', error);
      toast.error('Erro ao excluir gestor');
    }
  };

  const filteredManagers = managers.filter(manager =>
    manager.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    manager.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-display font-bold text-foreground mb-2">
              Gestão de Equipe
            </h1>
            <p className="text-foreground-secondary">
              Gerencie os gestores e visualize suas estatísticas
            </p>
          </div>

          {/* Search and Actions */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary" />
              <Input
                placeholder="Buscar gestor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Gestor
            </Button>
          </div>

          {/* Managers Table */}
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Alunos ativos</TableHead>
                  <TableHead className="text-center">Alunos inativos</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredManagers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-foreground-secondary">
                      Nenhum gestor encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredManagers.map((manager) => (
                    <TableRow key={manager.id}>
                      <TableCell className="font-medium">{manager.full_name}</TableCell>
                      <TableCell className="text-foreground-secondary">{manager.email}</TableCell>
                      <TableCell className="text-center">{manager.active_students}</TableCell>
                      <TableCell className="text-center">{manager.inactive_students}</TableCell>
                      <TableCell className="text-center font-medium">
                        {manager.active_students + manager.inactive_students}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              setSelectedManager(manager);
                              setFormData({
                                full_name: manager.full_name,
                                email: manager.email,
                                phone: manager.phone || "",
                                password: ""
                              });

                              // Load students assigned to this manager
                              const { data: assignedJourneys } = await supabase
                                .from('student_journeys')
                                .select('student_id')
                                .eq('manager_id', manager.id);

                              const assignedStudentIds = assignedJourneys?.map(j => j.student_id) || [];
                              setSelectedStudentIds(assignedStudentIds);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedManager(manager);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>

      {/* Create Manager Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Criar Novo Gestor</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo gestor
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Digite o nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Celular</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Senha temporária"
                />
              </div>
              <div className="space-y-2">
                <Label>Alunos Atribuídos</Label>
                <div className="border rounded-lg p-4 space-y-2 max-h-[200px] overflow-y-auto">
                  {students.length === 0 ? (
                    <p className="text-sm text-foreground-secondary">Nenhum aluno disponível</p>
                  ) : (
                    students.map((student) => (
                      <div key={student.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`student-${student.id}`}
                          checked={selectedStudentIds.includes(student.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStudentIds([...selectedStudentIds, student.id]);
                            } else {
                              setSelectedStudentIds(selectedStudentIds.filter(id => id !== student.id));
                            }
                          }}
                        />
                        <Label
                          htmlFor={`student-${student.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {student.full_name} ({student.email})
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setSelectedStudentIds([]);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateManager}>Criar Gestor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Manager Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Gestor</DialogTitle>
            <DialogDescription>
              Atualize os dados do gestor e gerencie seus alunos
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome Completo</Label>
                <Input
                  id="edit-name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Digite o nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Celular</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label>Alunos Atribuídos</Label>
                <div className="border rounded-lg p-4 space-y-2 max-h-[200px] overflow-y-auto">
                  {students.length === 0 ? (
                    <p className="text-sm text-foreground-secondary">Nenhum aluno disponível</p>
                  ) : (
                    students.map((student) => (
                      <div key={student.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-student-${student.id}`}
                          checked={selectedStudentIds.includes(student.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStudentIds([...selectedStudentIds, student.id]);
                            } else {
                              setSelectedStudentIds(selectedStudentIds.filter(id => id !== student.id));
                            }
                          }}
                        />
                        <Label
                          htmlFor={`edit-student-${student.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {student.full_name} ({student.email})
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setSelectedStudentIds([]);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleEditManager}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Manager Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Gestor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o gestor {selectedManager?.full_name}? 
              Todos os alunos atribuídos a este gestor ficarão sem gestor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteManager}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
