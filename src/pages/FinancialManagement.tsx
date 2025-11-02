import { useState, lazy, Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Loader2, Plus, UserPlus, Settings, DollarSign, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialMetricsCards } from "@/components/financial/FinancialMetricsCards";
import { CashFlowChart } from "@/components/financial/CashFlowChart";
import { AddCashFlowDialog } from "@/components/financial/AddCashFlowDialog";
import { CreateSubscriptionDialog } from "@/components/financial/CreateSubscriptionDialog";
import { ManageCategoriesDialog } from "@/components/financial/ManageCategoriesDialog";
import { useFinancialMetrics, useCashFlowChart } from "@/hooks/queries/useFinancialMetrics";

// Lazy load componentes pesados
const PlansManagement = lazy(() => import("@/components/financial/PlansManagement").then(m => ({ default: m.PlansManagement })));
const BonusManagement = lazy(() => import("@/components/financial/BonusManagement").then(m => ({ default: m.BonusManagement })));
const SubscriptionsTable = lazy(() => import("@/components/financial/SubscriptionsTable").then(m => ({ default: m.SubscriptionsTable })));
const PaymentsCalendar = lazy(() => import("@/components/financial/PaymentsCalendar").then(m => ({ default: m.PaymentsCalendar })));
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FinancialManagement = () => {
  const { userRole, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Estados dos dialogs
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showCreateSubscription, setShowCreateSubscription] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);

  // Buscar dados (com enabled para carregar apenas quando necessário)
  const { data: metrics, isLoading: metricsLoading } = useFinancialMetrics();
  const { data: cashFlowData, isLoading: cashFlowLoading } = useCashFlowChart(12);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Apenas administradores podem acessar
  if (userRole !== 'administrator') {
    return <Navigate to="/" replace />;
  }

  const isLoading = metricsLoading || cashFlowLoading;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-[1600px] mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Gestão Financeira
              </h1>
              <p className="text-foreground-secondary">
                Controle total das finanças da mentoria
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowManageCategories(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Categorias
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setShowAddIncome(true)}>
                    <DollarSign className="w-4 h-4 mr-2 text-green-500" />
                    Nova Receita
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowAddExpense(true)}>
                    <TrendingDown className="w-4 h-4 mr-2 text-red-500" />
                    Nova Despesa
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowCreateSubscription(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Nova Assinatura
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Dialogs */}
          <AddCashFlowDialog 
            open={showAddIncome} 
            onOpenChange={setShowAddIncome}
            defaultType="income"
          />
          <AddCashFlowDialog 
            open={showAddExpense} 
            onOpenChange={setShowAddExpense}
            defaultType="expense"
          />
          <CreateSubscriptionDialog 
            open={showCreateSubscription} 
            onOpenChange={setShowCreateSubscription}
          />
          <ManageCategoriesDialog 
            open={showManageCategories} 
            onOpenChange={setShowManageCategories}
          />

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Métricas Principais */}
              {metrics && (
                <FinancialMetricsCards
                  mrr={metrics.mrr}
                  arr={metrics.arr}
                  profitMonth={metrics.profit_month}
                  profitMargin={metrics.profit_margin}
                  activeStudents={metrics.active_students}
                  churnRate={metrics.churn_rate}
                  ltvCacRatio={metrics.ltv_cac_ratio}
                  runwayMonths={metrics.runway_months}
                />
              )}

              {/* Tabs de Navegação */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
                  <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                  <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
                  <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
                  <TabsTrigger value="plans">Planos</TabsTrigger>
                  <TabsTrigger value="bonus">Bônus</TabsTrigger>
                  <TabsTrigger value="expenses">Despesas</TabsTrigger>
                  <TabsTrigger value="reports">Relatórios</TabsTrigger>
                </TabsList>

                {/* Aba: Visão Geral */}
                <TabsContent value="overview" className="space-y-6">
                  {cashFlowData && <CashFlowChart data={cashFlowData} />}
                  
                  {/* Placeholder para mais componentes */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">
                        Receitas por Categoria
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Em desenvolvimento...
                      </p>
                    </div>
                    <div className="border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">
                        Despesas por Categoria
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Em desenvolvimento...
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* Aba: Fluxo de Caixa */}
                <TabsContent value="cashflow" className="space-y-6">
                  <div className="border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">
                      Entradas e Saídas
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Tabela de fluxo de caixa em desenvolvimento...
                    </p>
                  </div>
                </TabsContent>

                {/* Aba: Assinaturas */}
                <TabsContent value="subscriptions" className="space-y-6">
                  <Suspense fallback={
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  }>
                    <Tabs defaultValue="list" className="space-y-6">
                      <TabsList>
                        <TabsTrigger value="list">Lista</TabsTrigger>
                        <TabsTrigger value="calendar">Calendário</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="list">
                        <SubscriptionsTable />
                      </TabsContent>
                      
                      <TabsContent value="calendar">
                        <PaymentsCalendar />
                      </TabsContent>
                    </Tabs>
                  </Suspense>
                </TabsContent>

                {/* Aba: Planos */}
                <TabsContent value="plans" className="space-y-6">
                  <Suspense fallback={
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  }>
                    <PlansManagement />
                  </Suspense>
                </TabsContent>

                {/* Aba: Bônus */}
                <TabsContent value="bonus" className="space-y-6">
                  <Suspense fallback={
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  }>
                    <BonusManagement />
                  </Suspense>
                </TabsContent>

                {/* Aba: Despesas */}
                <TabsContent value="expenses" className="space-y-6">
                  <div className="border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">
                      Controle de Despesas
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Gerenciamento de despesas em desenvolvimento...
                    </p>
                  </div>
                </TabsContent>

                {/* Aba: Relatórios */}
                <TabsContent value="reports" className="space-y-6">
                  <div className="border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">
                      Relatórios Financeiros
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Exportação de relatórios em desenvolvimento...
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default FinancialManagement;

