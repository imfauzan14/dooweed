'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { PageHeader, StatCard, EmptyState } from '@/components/Navigation';
import { ExpensePieChart, MonthlyBarChart, CategoryLegend } from '@/components/Charts';
import { BudgetProgressCompact } from '@/components/BudgetProgress';
import { TransactionModal } from '@/components/TransactionForm';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  amountInBase: number | null;
  currency: string;
  description: string | null;
  date: string;
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
  } | null;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
}

interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  spent: number;
  percentUsed: number;
  category: {
    name: string;
    icon: string;
    color: string;
  };
}

export default function DashboardPage() {
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    transactionCount: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch all data in parallel
      const [summaryRes, transactionsRes, categoriesRes, categoryReportRes, monthlyRes, budgetsRes] =
        await Promise.all([
          fetch('/api/reports?type=summary&months=1'),
          fetch('/api/transactions?limit=5'),
          fetch('/api/categories'),
          fetch('/api/reports?type=category&months=1'),
          fetch('/api/reports?type=monthly&months=6'),
          fetch('/api/budgets'),
        ]);

      const [summaryData, transactionsData, categoriesData, categoryReport, monthlyReport, budgetsData] =
        await Promise.all([
          summaryRes.json(),
          transactionsRes.json(),
          categoriesRes.json(),
          categoryReportRes.json(),
          monthlyRes.json(),
          budgetsRes.json(),
        ]);

      setSummary(summaryData.data || { totalIncome: 0, totalExpense: 0, balance: 0, transactionCount: 0 });
      setRecentTransactions(transactionsData.data || []);
      setCategories(categoriesData.data || []);

      // Transform category data for pie chart
      const expenseCategories = (categoryReport.data || [])
        .filter((c: any) => c.type === 'expense')
        .map((c: any) => ({
          name: c.categoryName || 'Uncategorized',
          value: c.total,
          color: c.categoryColor || '#6B7280',
          icon: c.categoryIcon || '📁',
        }));
      setCategoryData(expenseCategories);

      setMonthlyData(monthlyReport.data || []);
      setBudgets(budgetsData.data || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTransaction = async (data: any) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setShowAddModal(false);
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 skeleton rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 skeleton rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 skeleton rounded-2xl" />
          <div className="h-80 skeleton rounded-2xl" />
        </div>
      </div>
    );
  }

  const overBudgetCount = budgets.filter((b) => b.percentUsed > 100).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
        action={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-medium hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg shadow-purple-500/20 btn-glow"
          >
            <Plus className="w-5 h-5" />
            Add Transaction
          </button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Balance"
          value={formatCurrency(summary.balance, 'IDR')}
          change={summary.balance >= 0 ? 'Positive balance' : 'Negative balance'}
          changeType={summary.balance >= 0 ? 'positive' : 'negative'}
          icon={<Wallet className="w-6 h-6 text-purple-400" />}
        />
        <StatCard
          label="Income (This Month)"
          value={formatCurrency(summary.totalIncome, 'IDR')}
          icon={<TrendingUp className="w-6 h-6 text-green-400" />}
        />
        <StatCard
          label="Expenses (This Month)"
          value={formatCurrency(summary.totalExpense, 'IDR')}
          icon={<TrendingDown className="w-6 h-6 text-red-400" />}
        />
        <StatCard
          label="Transactions"
          value={summary.transactionCount.toString()}
          change={overBudgetCount > 0 ? `${overBudgetCount} over budget` : undefined}
          changeType={overBudgetCount > 0 ? 'negative' : 'neutral'}
          icon={<Receipt className="w-6 h-6 text-blue-400" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense by Category */}
        <div className="p-6 glass-card rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4">Expenses by Category</h2>
          {categoryData.length > 0 ? (
            <>
              <ExpensePieChart data={categoryData} />
              <CategoryLegend data={categoryData} />
            </>
          ) : (
            <EmptyState
              icon={<Receipt className="w-8 h-8" />}
              title="No expenses yet"
              description="Add your first expense to see the breakdown"
            />
          )}
        </div>

        {/* Monthly Trend */}
        <div className="p-6 glass-card rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4">Income vs Expenses</h2>
          {monthlyData.length > 0 ? (
            <MonthlyBarChart data={monthlyData} />
          ) : (
            <EmptyState
              icon={<TrendingUp className="w-8 h-8" />}
              title="No data yet"
              description="Start tracking to see trends"
            />
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="p-6 glass-card rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
            <a href="/transactions" className="text-sm text-blue-400 hover:text-blue-300">
              View all
            </a>
          </div>
          {recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {recentTransactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${t.category?.color || '#6B7280'}20` }}
                  >
                    {t.category?.icon || '📁'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {t.description || t.category?.name || 'Transaction'}
                    </p>
                    <p className="text-xs text-gray-500">{format(new Date(t.date), 'MMM d')}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'font-semibold flex items-center gap-1 justify-end',
                        t.type === 'income' ? 'text-green-400' : 'text-red-400'
                      )}
                    >
                      {t.type === 'income' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      {formatCurrency(t.amountInBase || t.amount, 'IDR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Receipt className="w-8 h-8" />}
              title="No transactions"
              description="Add your first transaction to get started"
              action={
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                >
                  Add Transaction
                </button>
              }
            />
          )}
        </div>

        {/* Budget Overview */}
        <div className="p-6 glass-card rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Budget Overview</h2>
            <a href="/budgets" className="text-sm text-blue-400 hover:text-blue-300">
              Manage
            </a>
          </div>
          {budgets.length > 0 ? (
            <div className="space-y-4">
              {budgets.slice(0, 5).map((b) => (
                <BudgetProgressCompact
                  key={b.id}
                  categoryName={b.category?.name || 'Unknown'}
                  categoryIcon={b.category?.icon || '📁'}
                  budgetAmount={b.amount}
                  spentAmount={b.spent}
                />
              ))}
              {budgets.length > 5 && (
                <p className="text-sm text-gray-500 text-center">
                  +{budgets.length - 5} more budgets
                </p>
              )}
            </div>
          ) : (
            <EmptyState
              icon={<Wallet className="w-8 h-8" />}
              title="No budgets set"
              description="Create budgets to track your spending limits"
              action={
                <a
                  href="/budgets"
                  className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                >
                  Set Budget
                </a>
              }
            />
          )}
        </div>
      </div>

      {/* Add Transaction Modal */}
      <TransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        categories={categories}
        onSubmit={handleAddTransaction}
      />
    </div>
  );
}
