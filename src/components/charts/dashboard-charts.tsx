"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCompactIDR, formatIDR } from "@/lib/utils"
import { CHART_COLORS_DASHBOARD as COLORS, SEMANTIC_COLOR_INCOME, SEMANTIC_COLOR_EXPENSE } from "@/lib/chart-colors"

interface MonthlyData {
  month: string
  income: number
  expenses: number
}

interface WealthItem {
  name: string
  value: number
}

export function MonthlyCashFlowChart({ data }: { data: MonthlyData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Cash Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="month"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                stroke="var(--color-muted-foreground)"
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                stroke="var(--color-muted-foreground)"
                tickFormatter={(v: number) => formatCompactIDR(v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: any) => [formatIDR(Number(value))]}
              />
              <Line
                type="monotone"
                dataKey="income"
                stroke={SEMANTIC_COLOR_INCOME}
                strokeWidth={2}
                dot={false}
                name="Income"
              />
              <Line
                type="monotone"
                dataKey="expenses"
                stroke={SEMANTIC_COLOR_EXPENSE}
                strokeWidth={2}
                dot={false}
                name="Expenses"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export interface NetWorthPoint {
  month: string
  label: string
  cash: number
  gold: number
  stocks: number
  savings: number
  debt: number
  assets: number
  total: number
}

export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Net Wealth Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Add transactions to see your wealth trend.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Wealth Trend</CardTitle>
        <p className="text-xs text-muted-foreground">
          Cash flow + gold + stocks + savings &minus; debt, month by month
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SEMANTIC_COLOR_INCOME} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={SEMANTIC_COLOR_INCOME} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="debtFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SEMANTIC_COLOR_EXPENSE} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={SEMANTIC_COLOR_EXPENSE} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="label"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                stroke="var(--color-muted-foreground)"
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                stroke="var(--color-muted-foreground)"
                tickFormatter={(v: number) => formatCompactIDR(v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: any, name: any) => [
                  formatIDR(Number(value)),
                  name === "total" ? "Net wealth" : name === "debt" ? "Debt" : String(name),
                ]}
              />
              <Legend
                formatter={(value: string) =>
                  value === "total" ? "Net Wealth" : value === "debt" ? "Debt" : value
                }
                wrapperStyle={{ fontSize: "12px" }}
              />
              <Area
                type="monotone"
                dataKey="debt"
                stroke={SEMANTIC_COLOR_EXPENSE}
                strokeWidth={2}
                strokeDasharray="5 4"
                fill="url(#debtFill)"
                name="debt"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke={SEMANTIC_COLOR_INCOME}
                strokeWidth={2.5}
                fill="url(#netWorthFill)"
                name="total"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function WealthBreakdownChart({ data }: { data: WealthItem[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Wealth Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No data yet. Start adding your wealth!</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wealth Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: any) => [formatIDR(Number(value))]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2">
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
