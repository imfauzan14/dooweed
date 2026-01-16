'use client';

import { useState, useEffect } from 'react';
import { format, subMonths, addMonths, isAfter, startOfMonth, isSameMonth } from 'date-fns';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  MoreHorizontal,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Receipt,
  CreditCard,
  DollarSign,
  Tag,
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  receiptId?: string | null;
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
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  // Fetch available months on load
  useEffect(() => {
    fetch('/api/reports?type=available_months')
      .then(res => res.json())
      .then(data => {
        const currentMonth = format(new Date(), 'yyyy-MM');

        if (data.data && data.data.length > 0) {
          const months = data.data; // Already sorted desc by API
          // Always include current month even if it has no data
          if (!months.includes(currentMonth)) {
            setAvailableMonths([currentMonth, ...months]);
          } else {
            setAvailableMonths(months);
          }
        } else {
          // No data at all - just show current month
          setAvailableMonths([currentMonth]);
        }
      })
      .catch(err => console.error('Failed to fetch available months:', err));
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const monthParam = format(currentDate, 'yyyy-MM');
      const [summaryRes, recentRes, categoriesRes, categoryRes, monthlyRes, budgetsRes] = await Promise.all([
        fetch(`/api/reports?type=summary&month=${monthParam}`),
        fetch(`/api/reports?type=recent&month=${monthParam}`),
        fetch('/api/categories'),
        fetch(`/api/reports?type=category&month=${monthParam}`),
        fetch(`/api/reports?type=monthly&months=6`), // Monthly trend usually shows last 6 months context
        fetch('/api/budgets'),
      ]);

      const [summaryData, recentData, categoriesData, categoryReportData, monthlyReport, budgetsData] = await Promise.all([
        summaryRes.json(),
        recentRes.json(),
        categoriesRes.json(),
        categoryRes.json(),
        monthlyRes.json(),
        budgetsRes.json(),
      ]);

      setSummary(summaryData.data || { totalIncome: 0, totalExpense: 0, balance: 0, transactionCount: 0 });
      setRecentTransactions(recentData.data || []);
      setCategories(categoriesData.data || []);

      // Transform category data
      const expenseCategories = (categoryReportData.data || [])
        .filter((c: any) => c.type === 'expense')
        .map((c: any) => ({
          name: c.categoryName || 'Uncategorized',
          value: c.total,
          color: c.categoryColor || '#6B7280',
          icon: c.categoryIcon || <Tag className="w-4 h-4" />,
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

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const handlePrevMonth = () => {
    if (availableMonths.length > 0) {
      const currentMonthStr = format(currentDate, 'yyyy-MM');
      const currentIndex = availableMonths.indexOf(currentMonthStr);

      // If current month is in list
      if (currentIndex !== -1) {
        // Next item in list is "previous" in time (descending order)
        if (currentIndex < availableMonths.length - 1) {
          const nextMonthStr = availableMonths[currentIndex + 1];
          setCurrentDate(new Date(nextMonthStr + '-01'));
        }
      } else {
        // If current month is NOT in list (e.g. empty month), find the first one strictly before it
        // availableMonths is descending (2025-02, 2025-01, 2024-12)
        // If we are at 2025-03, we want 2025-02.
        // find first m where m < current
        const target = availableMonths.find(m => m < currentMonthStr);
        if (target) {
          setCurrentDate(new Date(target + '-01'));
        } else if (availableMonths.length > 0) {
          // Fallback to oldest
          setCurrentDate(new Date(availableMonths[availableMonths.length - 1] + '-01'));
        }
      }
    } else {
      // Fallback to standard behavior
      setCurrentDate(prev => subMonths(prev, 1));
    }
  };

  const handleNextMonth = () => {
    const today = new Date();
    const nextMonth = addMonths(currentDate, 1);

    // Prevent going to future
    if (isAfter(startOfMonth(nextMonth), startOfMonth(today))) return;

    if (availableMonths.length > 0) {
      const currentMonthStr = format(currentDate, 'yyyy-MM');
      const currentIndex = availableMonths.indexOf(currentMonthStr);

      if (currentIndex !== -1) {
        // Previous item in list is "next" in time (descending order)
        if (currentIndex > 0) {
          const prevMonthStr = availableMonths[currentIndex - 1];
          setCurrentDate(new Date(prevMonthStr + '-01'));
        } else {
          // We are at the latest data month.
          // Check if there is physically a next month that is <= today but maybe has no data?
          // If user wants to see "Current Month" even if empty, allow it if it is <= today.
          if (!isSameMonth(currentDate, today)) {
            // If not today, we can try to go to today or next real month
            setCurrentDate(prev => addMonths(prev, 1));
          }
        }
      } else {
        // Current month not in list.
        // Find first m where m > current
        // Since list is descending, we want the LAST item that is > current
        // e.g. [2025-02, 2025-01], we are at 2024-12. > current are 2025-02, 2025-01.
        // We want 2025-01.
        // Reverse availableMonths to be ascending?
        const ascending = [...availableMonths].reverse();
        const target = ascending.find(m => m > currentMonthStr);
        if (target) {
          // target is existing data month. It's safe.
          setCurrentDate(new Date(target + '-01'));
        } else {
          // No data in future. Allow going to today?
          if (!isSameMonth(currentDate, today)) {
            setCurrentDate(prev => addMonths(prev, 1));
          }
        }
      }
    } else {
      // Fallback
      setCurrentDate(prev => addMonths(prev, 1));
    }
  };

  const handleAddTransaction = async (data: any) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          amount: parseFloat(data.amount),
          categoryId: data.categoryId || null, // Ensure empty string becomes null
        }),
      });

      if (response.ok) {
        setShowAddModal(false);
        fetchData();
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
      {/* Header with Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevMonth}
            disabled={availableMonths.length === 0 || availableMonths.indexOf(format(currentDate, 'yyyy-MM')) === availableMonths.length - 1}
            className={cn(
              "p-1 rounded-lg transition-colors",
              availableMonths.length === 0 || availableMonths.indexOf(format(currentDate, 'yyyy-MM')) === availableMonths.length - 1
                ? "text-gray-700 cursor-not-allowed"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            )}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-medium text-white min-w-[140px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button
            onClick={handleNextMonth}
            className={cn(
              "p-1 rounded-lg transition-colors",
              isSameMonth(currentDate, new Date())
                ? "text-gray-600 cursor-not-allowed"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            )}
            disabled={isSameMonth(currentDate, new Date())}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-medium hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg shadow-purple-500/20 btn-glow w-full sm:w-auto justify-center"
        >
          <Plus className="w-5 h-5" />
          Add Transaction
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Balance"
          value={formatCurrency(summary.balance, 'IDR')}
          change={summary.balance >= 0 ? 'Positive' : 'Negative'}
          changeType={summary.balance >= 0 ? 'positive' : 'negative'}
          icon={<Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />}
        />
        <StatCard
          label="Income"
          value={formatCurrency(summary.totalIncome, 'IDR')}
          icon={<TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />}
        />
        <StatCard
          label="Expenses"
          value={formatCurrency(summary.totalExpense, 'IDR')}
          icon={<TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />}
        />
        <StatCard
          label="Txns"
          value={summary.transactionCount.toString()}
          change={overBudgetCount > 0 ? `${overBudgetCount} over` : undefined}
          changeType={overBudgetCount > 0 ? 'negative' : 'neutral'}
          icon={<Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense by Category */}
        <div className="p-6 glass-card rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4">Expenses ({format(currentDate, 'MMMM')})</h2>
          {categoryData.length > 0 ? (
            <>
              <ExpensePieChart data={categoryData} />
              <CategoryLegend data={categoryData} />
            </>
          ) : (
            <EmptyState
              icon={<Receipt className="w-8 h-8" />}
              title="No expenses"
              description={`No expenses found in ${format(currentDate, 'MMMM')}`}
            />
          )}
        </div>

        {/* Monthly Trend */}
        <div className="p-6 glass-card rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4">Income vs Expenses (6 Months)</h2>
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
        <div className="p-4 sm:p-6 glass-card rounded-2xl">
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
                  className="grid grid-cols-[auto_1fr_auto] gap-3 items-center p-3 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="relative">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg relative z-10"
                      style={{ backgroundColor: `${t.categoryColor || '#6B7280'}20` }}
                    >
                      {t.categoryIcon ? (
                        <span dangerouslySetInnerHTML={{ __html: t.categoryIcon }} />
                      ) : (
                        <Tag className="w-5 h-5" style={{ color: t.categoryColor || '#6B7280' }} />
                      )}
                    </div>
                    {/* Hide receipt overlay on mobile to reduce clutter */}
                    {t.receiptId && (
                      <div className="hidden sm:flex absolute -bottom-1 -right-1 z-20 bg-gray-900 rounded-md border border-gray-700 w-4 h-4 items-center justify-center overflow-hidden shadow-md">
                        <div className="w-2 h-2 bg-blue-400 rounded-full" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <p className="text-white font-medium truncate text-sm sm:text-base">
                      {(t.description || t.categoryName || 'Transaction')}
                    </p>
                    <p className="text-xs text-gray-500">{format(new Date(t.date), 'MMM d')}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'font-semibold flex items-center gap-1 justify-end text-sm sm:text-base',
                        t.type === 'income' ? 'text-green-400' : 'text-red-400'
                      )}
                    >
                      {t.type === 'income' ? (
                        <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 sm:w-4 sm:h-4" />
                      )}
                      {formatCurrency(t.amount, t.currency || 'IDR')}
                    </p>
                    {t.currency && t.currency !== 'IDR' && t.amountInBase && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        ~{formatCurrency(t.amountInBase, 'IDR')}
                      </p>
                    )}
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
        <div className="p-6 glass-card rounded-2xl hidden sm:block"> {/* Hide Budgets on mobile to save space? Or stick to user request */}
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
