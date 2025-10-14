import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Package } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BonusDelivery {
  id: string;
  bonus_id: string;
  delivered: boolean;
  delivered_at: string | null;
  delivered_by: string | null;
  notes: string | null;
  bonus: {
    name: string;
    description: string | null;
    cost: number;
  };
  deliveredByProfile?: {
    full_name: string;
  };
}

interface PlanBonusCardProps {
  studentId: string;
  bonusDeliveries: BonusDelivery[];
  isManager: boolean;
  onUpdate: () => void;
}

export const PlanBonusCard = ({ studentId, bonusDeliveries, isManager, onUpdate }: PlanBonusCardProps) => {
  const handleToggleDelivery = async (deliveryId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('student_bonus_delivery')
        .update({
          delivered: !currentStatus,
          delivered_at: !currentStatus ? new Date().toISOString() : null,
          delivered_by: !currentStatus ? (await supabase.auth.getUser()).data.user?.id : null,
        })
        .eq('id', deliveryId);

      if (error) throw error;

      toast.success(!currentStatus ? 'Bônus marcado como entregue' : 'Entrega desmarcada');
      onUpdate();
    } catch (error: any) {
      console.error('Error toggling bonus delivery:', error);
      toast.error('Erro ao atualizar status de entrega');
    }
  };

  const totalCost = bonusDeliveries.reduce((sum, bd) => sum + Number(bd.bonus.cost), 0);
  const deliveredCount = bonusDeliveries.filter(bd => bd.delivered).length;
  const totalCount = bonusDeliveries.length;

  if (bonusDeliveries.length === 0) {
    return null;
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Package className="h-5 w-5" />
          Bônus do Plano
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {bonusDeliveries.map((delivery) => (
          <div
            key={delivery.id}
            className={`p-4 rounded-lg border transition-all duration-200 ${
              delivery.delivered
                ? 'bg-green-500/5 border-green-500/20'
                : 'bg-muted/50 border-border'
            }`}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={delivery.delivered}
                onCheckedChange={() => handleToggleDelivery(delivery.id, delivery.delivered)}
                disabled={!isManager}
                className="mt-1"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  {delivery.delivered ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Package className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h4 className="font-semibold">{delivery.bonus.name}</h4>
                </div>
                {delivery.bonus.description && (
                  <p className="text-sm text-muted-foreground">
                    {delivery.bonus.description}
                  </p>
                )}
                {delivery.delivered && delivery.delivered_at && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-2">
                    <Badge variant="secondary" className="text-xs">
                      Entregue em {format(new Date(delivery.delivered_at), "dd/MM/yyyy", { locale: ptBR })}
                    </Badge>
                    {delivery.deliveredByProfile && (
                      <span>por {delivery.deliveredByProfile.full_name}</span>
                    )}
                  </div>
                )}
                {!delivery.delivered && (
                  <Badge variant="outline" className="text-xs">
                    Pendente de entrega
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-green-500">
                  R$ {Number(delivery.bonus.cost).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        ))}

        <div className="pt-4 border-t space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total de Bônus:</span>
            <span className="text-lg font-bold text-green-500">
              R$ {totalCost.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Entregues: {deliveredCount}/{totalCount}</span>
            <span>Pendentes: {totalCount - deliveredCount}/{totalCount}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
