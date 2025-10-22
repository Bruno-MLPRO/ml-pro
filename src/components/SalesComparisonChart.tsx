import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface SalesComparisonChartProps {
  advertisedSales: number;
  nonAdvertisedSales: number;
}

export const SalesComparisonChart = ({ advertisedSales, nonAdvertisedSales }: SalesComparisonChartProps) => {
  const data = [
    {
      name: "Últimos 30 dias",
      "Com Publicidade": advertisedSales,
      "Sem Publicidade": nonAdvertisedSales,
    },
  ];

  const total = advertisedSales + nonAdvertisedSales;
  const advertisedPercentage = total > 0 ? ((advertisedSales / total) * 100).toFixed(1) : 0;
  const organicPercentage = total > 0 ? ((nonAdvertisedSales / total) * 100).toFixed(1) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparativo de Vendas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Com Publicidade</p>
              <p className="text-2xl font-bold text-green-600">{advertisedSales}</p>
              <p className="text-xs text-muted-foreground">{advertisedPercentage}% do total</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Sem Publicidade</p>
              <p className="text-2xl font-bold text-purple-600">{nonAdvertisedSales}</p>
              <p className="text-xs text-muted-foreground">{organicPercentage}% do total</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Sem Publicidade" fill="#a855f7" stackId="a" />
              <Bar dataKey="Com Publicidade" fill="#10b981" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
