import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useCreateSubscription } from "@/hooks/queries/useSubscriptions";
import { supabase } from "@/integrations/supabase/client";
import type { PaymentMethod } from "@/types/financial";
import { format } from "date-fns";

interface CreateSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Student {
  id: string;
  full_name: string;
  email: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
}

export function CreateSubscriptionDialog({ open, onOpenChange }: CreateSubscriptionDialogProps) {
  const createSubscription = useCreateSubscription();

  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [studentId, setStudentId] = useState("");
  const [planId, setPlanId] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentDay, setPaymentDay] = useState("10");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [autoRenewal, setAutoRenewal] = useState(true);
  const [notes, setNotes] = useState("");

  // Buscar alunos e planos
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      // Buscar alunos (students)
      const { data: studentsData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', 
          (await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'student')).data?.map(r => r.user_id) || []
        )
        .order('full_name');

      // Buscar planos ativos
      const { data: plansData } = await supabase
        .from('plans')
        .select('id, name, price')
        .eq('is_active', true)
        .order('price');

      setStudents(studentsData || []);
      setPlans(plansData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoadingData(false);
    }
  };

  // Atualizar preço quando plano for selecionado
  const handlePlanChange = (planId: string) => {
    setPlanId(planId);
    const selectedPlan = plans.find(p => p.id === planId);
    if (selectedPlan) {
      setMonthlyPrice(selectedPlan.price.toString());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentId || !monthlyPrice || !startDate) {
      return;
    }

    createSubscription.mutate({
      student_id: studentId,
      plan_id: planId || null,
      monthly_price: parseFloat(monthlyPrice),
      start_date: startDate,
      payment_day: parseInt(paymentDay),
      payment_method: paymentMethod,
      auto_renewal: autoRenewal,
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        // Reset form
        setStudentId("");
        setPlanId("");
        setMonthlyPrice("");
        setStartDate(format(new Date(), 'yyyy-MM-dd'));
        setPaymentDay("10");
        setAutoRenewal(true);
        setNotes("");
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Criar Assinatura</DialogTitle>
            <DialogDescription>
              Vincule um aluno a um plano de mentoria
            </DialogDescription>
          </DialogHeader>

          {loadingData ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              {/* Aluno */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="student" className="text-right">
                  Aluno *
                </Label>
                <Select value={studentId} onValueChange={setStudentId} required>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecione o aluno" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.full_name} ({student.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Plano */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="plan" className="text-right">
                  Plano
                </Label>
                <Select value={planId} onValueChange={handlePlanChange}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecione o plano (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - R$ {plan.price.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Valor Mensal */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="price" className="text-right">
                  Valor Mensal *
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(e.target.value)}
                  className="col-span-3"
                  placeholder="0,00"
                  required
                />
              </div>

              {/* Data de Início */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="start-date" className="text-right">
                  Data de Início *
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>

              {/* Dia do Pagamento */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="payment-day" className="text-right">
                  Dia de Cobrança *
                </Label>
                <Input
                  id="payment-day"
                  type="number"
                  min="1"
                  max="28"
                  value={paymentDay}
                  onChange={(e) => setPaymentDay(e.target.value)}
                  className="col-span-3"
                  placeholder="Dia do mês (1-28)"
                  required
                />
              </div>

              {/* Método de Pagamento */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="payment-method" className="text-right">
                  Pagamento
                </Label>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="bank_transfer">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Renovação Automática */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="auto-renewal" className="text-right">
                  Renovação Auto
                </Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Switch
                    id="auto-renewal"
                    checked={autoRenewal}
                    onCheckedChange={setAutoRenewal}
                  />
                  <span className="text-sm text-muted-foreground">
                    {autoRenewal ? 'Ativada' : 'Desativada'}
                  </span>
                </div>
              </div>

              {/* Observações */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">
                  Observações
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="col-span-3"
                  placeholder="Informações adicionais..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createSubscription.isPending || loadingData}>
              {createSubscription.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Assinatura
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

