import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface MiniSparklineChartProps {
  data: Array<{ date: string; value: number }>;
  color?: string;
  height?: number;
}

/**
 * Mini gráfico sparkline para mostrar tendência de dados diários
 */
export function MiniSparklineChart({ 
  data, 
  color = "#8b5cf6",
  height = 40 
}: MiniSparklineChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  // Formatar dados para o gráfico (apenas valores, sem labels)
  const chartData = data.map(item => ({
    value: item.value || 0
  }));

  return (
    <div style={{ width: '100%', height: `${height}px`, overflow: 'hidden' }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${color.replace('#', '')})`}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

