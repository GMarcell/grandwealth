"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatIDR, formatCompactIDR } from "@/lib/utils"
import { CHART_COLORS, SEMANTIC_COLOR_INCOME, SEMANTIC_COLOR_EXPENSE } from "@/lib/chart-colors"

interface MonthlyItem {
  label: string
  income: number
  expenses: number
}

interface CategoryItem {
  category: string
  total: number
}

export function MonthlyBarChart({ data }: { data: MonthlyItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
          </svg>
          Monthly Income vs Expenses
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="label"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                stroke="var(--color-muted-foreground)"
              />
              <YAxis
                fontSize={11}
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
              <Legend />
              <Bar
                dataKey="income"
                name="Income"
                fill={SEMANTIC_COLOR_INCOME}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expenses"
                name="Expenses"
                fill={SEMANTIC_COLOR_EXPENSE}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function CategoryPieChart({
  data,
  title,
  type,
}: {
  data: CategoryItem[]
  title: string
  type: "expense" | "income"
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
            <path d="M22 12A10 10 0 0 0 12 2v10z" />
          </svg>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.map((e) => ({
                      name: e.category.replace(/_/g, " "),
                      value: e.total,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data.map((_, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
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
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
              {data.slice(0, 8).map((e, i) => (
                <div key={e.category} className="flex items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                  <span className="text-xs text-muted-foreground truncate max-w-24">
                    {e.category.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
            {data.length > 8 && (
              <p className="text-xs text-center text-muted-foreground mt-1">
                +{data.length - 8} more categories
              </p>
            )}
          </>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No {type} data in this period.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
