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
  active_students_pro: number;
  active_students_starter: number;
}

export default function TeamManagement() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'manager')) {
      navigate('/auth');
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    if (user && userRole === 'manager') {
      loadManagers();
    }
  }, [user, userRole]);

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
        .select('id, full_name, email')
        .in('id', managerIds);

      if (profilesError) throw profilesError;

      // Get student counts for each manager
      const managersWithStats = await Promise.all(
        profiles.map(async (profile) => {
          const { count: totalStudents } = await supabase
            .from('student_journeys')
            .select('*', { count: 'exact', head: true })
            .eq('manager_id', profile.id);

          // TODO: Implement PRO/STARTER classification when plan field is added
          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            active_students_pro: Math.floor((totalStudents || 0) * 0.6), // Mock data
            active_students_starter: Math.ceil((totalStudents || 0) * 0.4), // Mock data
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
        toast.error('Preencha todos os campos');
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

      toast.success('Gestor criado com sucesso');
      setIsCreateDialogOpen(false);
      setFormData({ full_name: "", email: "", password: "" });
      loadManagers();
    } catch (error: any) {
      console.error('Error creating manager:', error);
      toast.error(error.message || 'Erro ao criar gestor');
    }
  };

  const handleDeleteManager = async () => {
    if (!selectedManager) return;

    try {
      // Note: Deleting auth users requires admin privileges
      // This would typically be done via an edge function or admin API
      toast.info('Funcionalidade de exclusão em desenvolvimento');
      setIsDeleteDialogOpen(false);
      setSelectedManager(null);
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
                  <TableHead className="text-center">Alunos PRO</TableHead>
                  <TableHead className="text-center">Alunos STARTER</TableHead>
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
                      <TableCell className="text-center">{manager.active_students_pro}</TableCell>
                      <TableCell className="text-center">{manager.active_students_starter}</TableCell>
                      <TableCell className="text-center font-medium">
                        {manager.active_students_pro + manager.active_students_starter}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedManager(manager);
                              setFormData({
                                full_name: manager.full_name,
                                email: manager.email,
                                password: ""
                              });
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Gestor</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo gestor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Digite o nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Senha temporária"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateManager}>Criar Gestor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Manager Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Gestor</DialogTitle>
            <DialogDescription>
              Funcionalidade em desenvolvimento
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Manager Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Gestor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o gestor {selectedManager?.full_name}? 
              Esta ação não pode ser desfeita.
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
