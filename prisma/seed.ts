import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

function randomAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) / 100) * 100
}

function randomDate(startYear: number, startMonth: number, endYear: number, endMonth: number): Date {
  const start = new Date(startYear, startMonth, 1)
  const end = new Date(endYear, endMonth + 1, 0)
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

const EXPENSE_DESCRIPTIONS: Record<string, string[]> = {
  FOOD: ["Lunch at Padang", "Grocery shopping", "Dinner at Sate House", "Coffee & snacks", "Weekly groceries", "Fresh mart", "Bakso & es teh", "Nasi goreng delivery"],
  TRANSPORTATION: ["Gas station", "Toll road", "Gojek ride", "Grab ride", "Bus ticket", "Train fare", "Parking fee"],
  HOUSING: ["Rent payment", "Electricity bill", "Water bill", "Internet bill", "Apartment maintenance", "Property tax"],
  UTILITIES: ["PLN token", "PAM water", "Gas cylinder", "Phone bill"],
  HEALTHCARE: ["Doctor visit", "Pharmacy", "Health insurance", "Vitamins", "Dental checkup"],
  EDUCATION: ["Online course", "Book purchase", "Workshop fee", "Training materials", "Tuition fee"],
  ENTERTAINMENT: ["Netflix subscription", "Movie tickets", "Concert tickets", "Spotify premium", "Game purchase", "Streaming service"],
  SHOPPING: ["Clothing", "Electronics", "Home decor", "Kitchen supplies", "New shoes", "Bag"],
  TRAVEL: ["Hotel booking", "Flight ticket", "Travel insurance", "Souvenirs", "Tour guide"],
  INSURANCE: ["Life insurance", "Health insurance premium", "Car insurance", "Home insurance"],
  TAX: ["Annual tax", "Vehicle tax", "Income tax"],
  SUBSCRIPTION: ["Cloud storage", "VPN service", "Gym membership", "Software license", "Magazine subscription"],
  SALARY: ["Monthly salary", "Bonus payment", "13th month pay"],
  FREELANCE: ["Web design project", "Consulting fee", "Writing gig", "Photography project"],
  BUSINESS: ["Business revenue", "Client payment", "Product sales"],
  INVESTMENT: ["Dividend payment", "Bond interest", "REIT distribution"],
  DIVIDEND: ["Stock dividend", "Mutual fund dividend"],
  INTEREST: ["Bank interest", "Savings interest", "Deposit interest"],
  RENTAL: ["Apartment rental income", "Property rental", "Car rental"],
  GIFT: ["Birthday gift", "Holiday gift", "Wedding gift"],
  REFUND: ["Tax refund", "Product return", "Insurance claim"],
  OTHER_INCOME: ["Cashback", "Rewards", "Side gig", "Commission"],
  OTHER_EXPENSE: ["Miscellaneous", "Donation", "Charity", "Wedding gift"],
}

async function main() {
  console.log("🌱 Seeding database...")

  // Clean existing data
  await prisma.recurringTransaction.deleteMany()
  await prisma.budget.deleteMany()
  await prisma.category.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.goldDeposit.deleteMany()
  await prisma.stock.deleteMany()
  await prisma.account.deleteMany()
  await prisma.session.deleteMany()
  await prisma.verificationToken.deleteMany()
  await prisma.user.deleteMany()

  console.log("  ✓ Cleaned existing data")

  // Create demo user
  const hashedPassword = await hash("demo123456", 12)
  const user = await prisma.user.create({
    data: {
      name: "Demo User",
      email: "demo@example.com",
      password: hashedPassword,
    },
  })

  console.log(`  ✓ Created demo user: demo@example.com / demo123456`)

  // Create custom categories
  const customCategories = [
    { name: "PETROL", type: "EXPENSE", color: "#f97316" },
    { name: "COFFEE", type: "EXPENSE", color: "#8b5cf6" },
    { name: "CLOUD_SERVICES", type: "EXPENSE", color: "#06b6d4" },
    { name: "FREELANCE_INCOME", type: "INCOME", color: "#10b981" },
    { name: "CRYPTO", type: "INCOME", color: "#f59e0b" },
  ]

  for (const cat of customCategories) {
    await prisma.category.create({
      data: { ...cat, userId: user.id },
    })
  }

  console.log(`  ✓ Created ${customCategories.length} custom categories`)

  // Generate transactions for the past 12 months
  const now = new Date()
  const transactions: Array<{
    type: "INCOME" | "EXPENSE"
    category: string
    amount: number
    description: string
    date: Date
    userId: string
  }> = []

  const incomeCategories = ["SALARY", "FREELANCE", "BUSINESS", "INVESTMENT", "DIVIDEND", "INTEREST", "RENTAL", "GIFT", "REFUND", "OTHER_INCOME", "FREELANCE_INCOME", "CRYPTO"]
  const expenseCategories = ["FOOD", "TRANSPORTATION", "HOUSING", "UTILITIES", "HEALTHCARE", "EDUCATION", "ENTERTAINMENT", "SHOPPING", "TRAVEL", "INSURANCE", "TAX", "SUBSCRIPTION", "OTHER_EXPENSE", "PETROL", "COFFEE", "CLOUD_SERVICES"]

  // Salary: consistent monthly income
  for (let month = 11; month >= 0; month--) {
    const date = new Date(now.getFullYear(), now.getMonth() - month, Math.floor(Math.random() * 5) + 25)
    transactions.push({
      type: "INCOME",
      category: "SALARY",
      amount: 12000000 + Math.floor(Math.random() * 2000000 - 1000000),
      description: "Monthly salary",
      date,
      userId: user.id,
    })
  }

  // Other transactions
  for (let month = 11; month >= 0; month--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - month, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - month + 1, 0)

    // 2-4 income transactions per month
    const incomeCount = Math.floor(Math.random() * 3) + 2
    for (let i = 0; i < incomeCount; i++) {
      const cat = randomItem(incomeCategories.filter(c => c !== "SALARY"))
      const descs = EXPENSE_DESCRIPTIONS[cat]
      transactions.push({
        type: "INCOME",
        category: cat,
        amount: randomAmount(500000, 5000000),
        description: descs ? randomItem(descs) : `${cat.replace("_", " ")} income`,
        date: randomDate(monthStart.getFullYear(), monthStart.getMonth(), monthEnd.getFullYear(), monthEnd.getMonth()),
        userId: user.id,
      })
    }

    // 8-15 expense transactions per month
    const expenseCount = Math.floor(Math.random() * 8) + 8
    for (let i = 0; i < expenseCount; i++) {
      const cat = randomItem(expenseCategories)
      const descs = EXPENSE_DESCRIPTIONS[cat]
      transactions.push({
        type: "EXPENSE",
        category: cat,
        amount: cat === "HOUSING" ? randomAmount(2000000, 5000000) : randomAmount(15000, 500000),
        description: descs ? randomItem(descs) : `${cat.replace("_", " ")} expense`,
        date: randomDate(monthStart.getFullYear(), monthStart.getMonth(), monthEnd.getFullYear(), monthEnd.getMonth()),
        userId: user.id,
      })
    }
  }

  // Save transactions in batches
  const batchSize = 50
  for (let i = 0; i < transactions.length; i += batchSize) {
    await prisma.transaction.createMany({
      data: transactions.slice(i, i + batchSize),
    })
  }

  console.log(`  ✓ Created ${transactions.length} transactions`)

  // Create budgets for the last 6 months + current month
  const budgetAmounts: Record<string, number> = {
    FOOD: 1500000,
    TRANSPORTATION: 800000,
    HOUSING: 5000000,
    UTILITIES: 500000,
    HEALTHCARE: 300000,
    EDUCATION: 500000,
    ENTERTAINMENT: 400000,
    SHOPPING: 1000000,
    TRAVEL: 1000000,
    INSURANCE: 500000,
    TAX: 200000,
    SUBSCRIPTION: 200000,
    OTHER_EXPENSE: 300000,
    PETROL: 800000,
    COFFEE: 200000,
    CLOUD_SERVICES: 150000,
  }

  for (let month = 6; month >= 0; month--) {
    const d = new Date(now.getFullYear(), now.getMonth() - month, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`

    for (const [category, amount] of Object.entries(budgetAmounts)) {
      await prisma.budget.create({
        data: {
          categoryName: category,
          amount: month <= 1 ? amount : Math.round(amount * (0.9 + Math.random() * 0.2)),
          month: monthKey,
          rolloverEnabled: Math.random() > 0.3,
          rolloverCap: Math.random() > 0.7 ? amount * 0.5 : null,
          userId: user.id,
        },
      })
    }
  }

  console.log(`  ✓ Created budgets for 7 months`)

  // Gold deposits
  const goldDeposits = [
    { type: "BUY" as const, weightGram: 10, pricePerGram: 950000, date: new Date(now.getFullYear(), now.getMonth() - 10, 15), notes: "Antam 10g" },
    { type: "BUY" as const, weightGram: 25, pricePerGram: 970000, date: new Date(now.getFullYear(), now.getMonth() - 6, 20), notes: "Antam 25g" },
    { type: "BUY" as const, weightGram: 5, pricePerGram: 990000, date: new Date(now.getFullYear(), now.getMonth() - 3, 10), notes: "Antam 5g" },
    { type: "SELL" as const, weightGram: 5, pricePerGram: 1020000, date: new Date(now.getFullYear(), now.getMonth() - 1, 5), notes: "Sold 5g for profit" },
    { type: "BUY" as const, weightGram: 10, pricePerGram: 1010000, date: new Date(now.getFullYear(), now.getMonth(), 1), notes: "Antam 10g" },
  ]

  for (const g of goldDeposits) {
    await prisma.goldDeposit.create({
      data: {
        type: g.type,
        weightGram: g.weightGram,
        pricePerGram: g.pricePerGram,
        totalAmount: g.weightGram * g.pricePerGram,
        date: g.date,
        notes: g.notes,
        userId: user.id,
      },
    })
  }

  console.log(`  ✓ Created ${goldDeposits.length} gold records`)

  // Stock portfolio
  const stocks = [
    { symbol: "BBCA", name: "Bank Central Asia Tbk", quantity: 100, buyPrice: 10250, date: new Date(now.getFullYear(), now.getMonth() - 11, 10) },
    { symbol: "BBRI", name: "Bank Rakyat Indonesia Tbk", quantity: 200, buyPrice: 4950, date: new Date(now.getFullYear(), now.getMonth() - 10, 15) },
    { symbol: "TLKM", name: "Telkom Indonesia Tbk", quantity: 300, buyPrice: 3850, date: new Date(now.getFullYear(), now.getMonth() - 8, 20) },
    { symbol: "ASII", name: "Astra International Tbk", quantity: 50, buyPrice: 6250, date: new Date(now.getFullYear(), now.getMonth() - 6, 5) },
    { symbol: "GOTO", name: "GoTo Gojek Tokopedia Tbk", quantity: 500, buyPrice: 420, date: new Date(now.getFullYear(), now.getMonth() - 4, 12) },
  ]

  for (const s of stocks) {
    await prisma.stock.create({
      data: {
        ...s,
        notes: null,
        userId: user.id,
      },
    })
  }

  console.log(`  ✓ Created ${stocks.length} stocks`)

  // Create recurring transactions
  const recurringTransactions = [
    {
      type: "EXPENSE" as const,
      category: "SUBSCRIPTION",
      amount: 100000,
      description: "Netflix subscription",
      frequency: "MONTHLY" as const,
      startDate: new Date(now.getFullYear(), now.getMonth() - 5, 1),
      nextDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      active: true,
    },
    {
      type: "EXPENSE" as const,
      category: "SUBSCRIPTION",
      amount: 55000,
      description: "Spotify Premium",
      frequency: "MONTHLY" as const,
      startDate: new Date(now.getFullYear(), now.getMonth() - 8, 1),
      nextDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      active: true,
    },
    {
      type: "EXPENSE" as const,
      category: "SUBSCRIPTION",
      amount: 150000,
      description: "Cloud storage (Google One)",
      frequency: "MONTHLY" as const,
      startDate: new Date(now.getFullYear(), now.getMonth() - 3, 1),
      nextDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      active: true,
    },
    {
      type: "EXPENSE" as const,
      category: "INSURANCE",
      amount: 350000,
      description: "Health insurance premium",
      frequency: "MONTHLY" as const,
      startDate: new Date(now.getFullYear(), now.getMonth() - 12, 1),
      nextDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      active: true,
    },
    {
      type: "INCOME" as const,
      category: "SALARY",
      amount: 12000000,
      description: "Monthly salary",
      frequency: "MONTHLY" as const,
      startDate: new Date(now.getFullYear(), now.getMonth() - 12, 25),
      nextDate: new Date(now.getFullYear(), now.getMonth() + 1, 25),
      active: true,
    },
    {
      type: "EXPENSE" as const,
      category: "HOUSING",
      amount: 4500000,
      description: "Apartment rent",
      frequency: "MONTHLY" as const,
      startDate: new Date(now.getFullYear(), now.getMonth() - 12, 1),
      nextDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      active: true,
    },
    {
      type: "EXPENSE" as const,
      category: "TRANSPORTATION",
      amount: 50000,
      description: "Gojek monthly commute pass",
      frequency: "WEEKLY" as const,
      startDate: new Date(now.getFullYear(), now.getMonth() - 4, 1),
      nextDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      active: true,
    },
    {
      type: "EXPENSE" as const,
      category: "SUBSCRIPTION",
      amount: 149000,
      description: "AWS Cloud services",
      frequency: "MONTHLY" as const,
      startDate: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      nextDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      active: true,
      endDate: new Date(now.getFullYear(), now.getMonth() + 6, 1),
    },
  ]

  for (const rt of recurringTransactions) {
    await prisma.recurringTransaction.create({
      data: {
        ...rt,
        userId: user.id,
      },
    })
  }

  console.log(`  ✓ Created ${recurringTransactions.length} recurring transactions`)
  console.log("")
  console.log("🎉 Seeding complete!")
  console.log("   Email:    demo@example.com")
  console.log("   Password: demo123456")
}

main()
  .catch((e) => {
    console.error("Seed error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
