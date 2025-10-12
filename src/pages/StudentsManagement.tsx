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
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { Checkbox } from "@/components/ui/checkbox";

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
}

const DEFAULT_PASSWORD = "12345678";

export default function StudentsManagement() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    turma: "",
    estrutura_vendedor: "CPF",
    tipo_pj: "",
    possui_contador: false,
    caixa: "",
    hub_logistico: "Pretendo usar",
    sistemas_externos: "",
    mentoria_status: "Ativo",
  });

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'manager')) {
      navigate('/auth');
      return;
    }

    if (user && userRole === 'manager') {
      fetchStudents();

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

  const fetchStudents = async () => {
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "student");

    if (!rolesData) return;

    const studentIds = rolesData.map((r) => r.user_id);

    const { data, error } = await supabase
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

    setStudents(data || []);
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
          estrutura_vendedor: formData.estrutura_vendedor,
          tipo_pj: formData.estrutura_vendedor === "PJ" ? formData.tipo_pj : null,
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
        estrutura_vendedor: formData.estrutura_vendedor,
        tipo_pj: formData.estrutura_vendedor === "PJ" ? formData.tipo_pj : null,
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
    fetchStudents();
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
      estrutura_vendedor: student.estrutura_vendedor || "CPF",
      tipo_pj: student.tipo_pj || "",
      possui_contador: student.possui_contador || false,
      caixa: student.caixa?.toString() || "",
      hub_logistico: student.hub_logistico || "Pretendo usar",
      sistemas_externos: student.sistemas_externos || "",
      mentoria_status: student.mentoria_status || "Ativo",
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      turma: "",
      estrutura_vendedor: "CPF",
      tipo_pj: "",
      possui_contador: false,
      caixa: "",
      hub_logistico: "Pretendo usar",
      sistemas_externos: "",
      mentoria_status: "Ativo",
    });
    setSelectedStudent(null);
  };

  const filteredStudents = students.filter(
    (student) =>
      student.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <Input
          id="turma"
          placeholder="Ex: Turma 4 - Starter"
          value={formData.turma}
          onChange={(e) => setFormData({ ...formData, turma: e.target.value })}
        />
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
        <div className="grid gap-2">
          <Label htmlFor="tipo_pj">Tipo de PJ</Label>
          <Select value={formData.tipo_pj} onValueChange={(value) => setFormData({ ...formData, tipo_pj: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEI">MEI</SelectItem>
              <SelectItem value="ME">ME</SelectItem>
            </SelectContent>
          </Select>
        </div>
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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Gerenciamento de Alunos</h1>
          <p className="text-muted-foreground">Gerencie os alunos da plataforma</p>
        </div>

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
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        student.mentoria_status === "Ativo"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
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
      </div>
    </div>
  );
}
