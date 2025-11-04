import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, TrendingUp, Clock } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { LeadKanban } from "@/components/acquisition/LeadKanban";
import { SalesStudentsTable } from "@/components/acquisition/SalesStudentsTable";
import { useQuery } from "@tanstack/react-query";
import { getLeadMetrics, getOnboardingMetrics } from "@/services/api/leads";

export default function AcquisitionHub() {
  const [activeTab, setActiveTab] = useState("pipeline");

  // Query: Métricas de leads
  const { data: leadMetrics } = useQuery({
    queryKey: ["lead-metrics"],
    queryFn: getLeadMetrics
  });

  // Query: Métricas de onboarding
  const { data: onboardingMetrics } = useQuery({
    queryKey: ["onboarding-metrics"],
    queryFn: getOnboardingMetrics
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Hub de Aquisição</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie leads, conversões e onboarding em um só lugar
        </p>
      </div>

      {/* KPIs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="w-4 h-4" />
              Total de Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadMetrics?.total_leads || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ativos no pipeline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leadMetrics?.taxa_conversao.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Leads convertidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Alunos em Onboarding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {onboardingMetrics?.total_alunos || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Aguardando conclusão
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Tempo Médio de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leadMetrics?.tempo_medio_conversao_dias.toFixed(1) || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              dias para converter
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Pipeline de Leads e Gestão de Alunos */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pipeline">Pipeline de Leads</TabsTrigger>
          <TabsTrigger value="onboarding">Gestão de Alunos</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline de Leads (Kanban)</CardTitle>
              <CardDescription>
                Arraste e solte os leads entre as colunas para atualizar o status.
                Ao mover para "Convertido", você poderá registrar a venda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadKanban />
            </CardContent>
          </Card>

          {/* Métricas Detalhadas de Vendas */}
          {leadMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Volume de Vendas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    R$ {leadMetrics.volume_vendas.toFixed(2)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Total em vendas convertidas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Leads por Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(leadMetrics.leads_por_status).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center">
                        <span className="text-sm">{status}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Alunos (Onboarding)</CardTitle>
              <CardDescription>
                Acompanhe o processo de onboarding de cada aluno convertido.
                Marque os checkboxes conforme cada etapa for concluída.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SalesStudentsTable />
            </CardContent>
          </Card>

          {/* Métricas de Onboarding */}
          {onboardingMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Progresso do Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Call de Onboarding</div>
                    <div className="text-2xl font-bold">{onboardingMetrics.checklist_completion.call_feita}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Catálogo Liberado</div>
                    <div className="text-2xl font-bold">{onboardingMetrics.checklist_completion.catalogo_liberado}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Memberkit Liberado</div>
                    <div className="text-2xl font-bold">{onboardingMetrics.checklist_completion.memberkit_liberado}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Grupos OK</div>
                    <div className="text-2xl font-bold">{onboardingMetrics.checklist_completion.grupos_ok}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Fornecedores OK</div>
                    <div className="text-2xl font-bold">{onboardingMetrics.checklist_completion.fornecedores_ok}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Bônus OK</div>
                    <div className="text-2xl font-bold">{onboardingMetrics.checklist_completion.bonus_ok}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      </main>
    </div>
  );
}

