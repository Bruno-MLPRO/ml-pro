import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Phone, Mail, MapPin, Building2 } from "lucide-react";
import type { StudentProfile } from "@/types/students";
import { PlanBonusCard } from "@/components/PlanBonusCard";
import type { ReactNode } from "react";

interface StudentProfileSectionProps {
  student: StudentProfile;
  studentId: string;
  bonusDeliveries: any[];
  consolidatedMetrics: {
    total_sales: number;
    total_revenue: number;
    average_ticket: number;
  } | null;
  onUpdateBonus?: () => void;
  appsSection?: ReactNode;
}

export function StudentProfileSection({
  student,
  studentId,
  bonusDeliveries,
  consolidatedMetrics,
  onUpdateBonus,
  appsSection
}: StudentProfileSectionProps) {
  return (
    <>
      <div className={`grid items-stretch gap-6 ${appsSection ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {/* Informações Pessoais */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{student.email}</span>
            </div>
            {(student as any).phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <button
                  onClick={() => {
                    // Remove caracteres não numéricos do telefone
                    const cleanPhone = (student as any).phone.replace(/\D/g, '');
                    // Abre WhatsApp em nova aba
                    window.open(`https://wa.me/55${cleanPhone}`, '_blank');
                  }}
                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                >
                  {(student as any).phone}
                </button>
              </div>
            )}
            {(student as any).estado && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{(student as any).estado}</span>
              </div>
            )}
            {(student as any).turma && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>Turma: {(student as any).turma}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estrutura e Financeiro */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Estrutura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Estrutura</p>
              <p className="font-medium">{(student as any).estrutura_vendedor || 'Não informado'}</p>
            </div>
            {(student as any).tipo_pj && (
              <div>
                <p className="text-sm text-muted-foreground">Tipo PJ</p>
                <p className="font-medium">{(student as any).tipo_pj}</p>
              </div>
            )}
            {(student as any).cnpj && (
              <div>
                <p className="text-sm text-muted-foreground">CNPJ</p>
                <p className="font-medium">{(student as any).cnpj}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Contador</p>
              <p className="font-medium">{(student as any).possui_contador ? 'Sim' : 'Não'}</p>
            </div>
            {(student as any).caixa !== null && (student as any).caixa !== undefined && (
              <div>
                <p className="text-sm text-muted-foreground">Caixa</p>
                <p className="font-medium">
                  {new Intl.NumberFormat('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                  }).format((student as any).caixa)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Apps e Extensões - Coluna 3 */}
        {appsSection && (
          <div className="h-full">
            {appsSection}
          </div>
        )}
      </div>

      {/* Resumo de Performance ML */}
      {consolidatedMetrics && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Performance Mercado Livre</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Vendas Totais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{consolidatedMetrics.total_sales}</div>
                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  }).format(consolidatedMetrics.total_revenue)}
                </div>
                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                  }).format(consolidatedMetrics.average_ticket)}
                </div>
                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Bônus do Plano */}
      <PlanBonusCard
        studentId={studentId}
        bonusDeliveries={bonusDeliveries}
        isManager={true}
        onUpdate={onUpdateBonus}
      />
    </>
  );
}

