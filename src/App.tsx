/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Send, 
  RotateCcw, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Search, 
  Bell, 
  Plus, 
  ChevronRight,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Sparkles,
  User,
  Bot,
  X
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  category: string;
  unit: string;
  price: number;
  minStock: number;
}

interface Project {
  id: string;
  name: string;
  allocations: Record<string, number>; // Product ID -> Amount
}

interface Dispatch {
  id: string;
  productId: string;
  amount: number;
  employeeName: string;
  projectName: string;
  timestamp: number;
  returnedAmount: number;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  history: Array<{
    productId: string;
    amount: number;
    timestamp: number;
  }>;
}

interface Employee {
  id: string;
  name: string;
  role: string;
}

type Tab = 'dashboard' | 'inventory' | 'dispatch' | 'returns' | 'customers' | 'history' | 'management';

// Initial Mock Data
const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'UltraSeal Pro 5000', sku: 'US-5000', stock: 120, category: 'Sealants', unit: 'Gallon', price: 85, minStock: 20 },
  { id: '2', name: 'RoofX Mesh Roll', sku: 'RX-MS-01', stock: 45, category: 'Membranes', unit: 'Roll', price: 210, minStock: 10 },
  { id: '3', name: 'Kote Prime 202', sku: 'KP-202', stock: 15, category: 'Primers', unit: 'Pail', price: 65, minStock: 25 },
  { id: '4', name: 'Titan Edge Drip', sku: 'TE-DR-99', stock: 300, category: 'Hardware', unit: 'Linear Ft', price: 4.5, minStock: 50 },
];

const INITIAL_PROJECTS: Project[] = [
  { id: 'p1', name: 'San Juan Executive Suites', allocations: { '1': 50, '2': 10 } },
  { id: 'p2', name: 'Bayamón Logistics Center', allocations: { '3': 40, '1': 100 } },
];

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Roofing Soluciones PR', email: 'sales@roofingsolutions.pr', history: [{ productId: '1', amount: 20, timestamp: Date.now() - 86400000 }] },
  { id: 'c2', name: 'Caribe Contractors', email: 'info@caribecon.com', history: [{ productId: '4', amount: 150, timestamp: Date.now() - 172800000 }] },
];

const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Carlos Rivera', role: 'Project Lead' },
  { id: 'e2', name: 'Maria Santos', role: 'Inventory Manager' },
  { id: 'e3', name: 'Jose Mercado', role: 'Field Technician' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: 'Hello! I am your AI Inventory Assistant. I have full context of your Warehouse, Projects, and Dispatches. How can I help you today?' }
  ]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  
  // AI Initialization
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('qu_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('qu_projects');
    return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
  });
  const [dispatches, setDispatches] = useState<Dispatch[]>(() => {
    const saved = localStorage.getItem('qu_dispatches');
    return saved ? JSON.parse(saved) : [];
  });
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('qu_customers');
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('qu_employees');
    return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
  });
  const [notifications, setNotifications] = useState<Array<{id: number, text: string}>>([]);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('qu_products', JSON.stringify(products));
    localStorage.setItem('qu_projects', JSON.stringify(projects));
    localStorage.setItem('qu_dispatches', JSON.stringify(dispatches));
    localStorage.setItem('qu_customers', JSON.stringify(customers));
    localStorage.setItem('qu_employees', JSON.stringify(employees));
  }, [products, projects, dispatches, customers, employees]);

  const addNotification = (text: string) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, text }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const handleAiMessage = async (userText: string) => {
    if (!userText.trim()) return;
    
    const newUserMsg = { role: 'user' as const, text: userText };
    setChatMessages(prev => [...prev, newUserMsg]);
    setIsAiTyping(true);

    try {
      // Context for AI
      const systemContext = `
        You are the "Químicas Unidas AI Assistant". You manage a complex roofing chemical warehouse and project logistics.
        
        CURRENT DATA:
        - MASTER INVENTORY: ${JSON.stringify(products.map(p => ({ name: p.name, sku: p.sku, stock: p.stock, unit: p.unit })))}
        - ACTIVE PROJECTS: ${JSON.stringify(projects.map(pj => ({ name: pj.name, allocations: pj.allocations })))}
        - DISPATCH HISTORY: ${JSON.stringify(dispatches.slice(-10).map(d => ({ project: d.projectName, product: d.productId, amount: d.amount, date: new Date(d.timestamp).toLocaleDateString() })))}
        - CUSTOMERS: ${JSON.stringify(customers.map(c => ({ name: c.name, projectsCount: c.history.length })))}
        
        RULES:
        1. Always be professional and brief. 
        2. If asked about stock, give precise numbers from the MASTER INVENTORY.
        3. If asked about forecasts, look at Dispatch History to suggest trends.
        4. Use bold text for numbers and product names.
        5. You can answer in English or Spanish as requested.
        
        Wait for the user's input.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: systemContext }] },
          ...chatMessages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
          })),
          { role: 'user', parts: [{ text: userText }] }
        ],
        config: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        }
      });

      const aiText = response.text || "I'm sorry, I encountered an error processing that request.";
      setChatMessages(prev => [...prev, { role: 'model', text: aiText }]);
    } catch (error) {
      console.error("AI Error:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: "Systems offline. Please check connectivity." }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // Logic: Dispatch to Project
  const handleDispatch = (productId: string, amount: number, employee: string, projectName: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (product.stock < amount) {
      addNotification("Error: Insufficient warehouse stock.");
      return;
    }

    // Check allocation
    const project = projects.find(p => p.name === projectName);
    const allocation = project?.allocations[productId] || 0;
    const previouslyDispatched = dispatches
      .filter(d => d.projectName === projectName && d.productId === productId)
      .reduce((sum, d) => sum + d.amount, 0);

    if (allocation > 0 && previouslyDispatched + amount > allocation) {
      addNotification("Warning: Requested amount exceeds project allocation.");
      // We still allow it as per prompt requirements, but trigger high-vis warning.
    }

    const newDispatch: Dispatch = {
      id: Math.random().toString(36).substr(2, 9),
      productId,
      amount,
      employeeName: employee,
      projectName,
      timestamp: Date.now(),
      returnedAmount: 0
    };

    setDispatches(prev => [newDispatch, ...prev]);
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: p.stock - amount } : p));
    addNotification(`Success: ${amount} ${product.unit}s dispatched to ${projectName}.`);
  };

  // Logic: Return Surplus
  const handleReturn = (dispatchId: string, returnAmount: number) => {
    const dispatch = dispatches.find(d => d.id === dispatchId);
    if (!dispatch) return;

    const remaining = dispatch.amount - dispatch.returnedAmount;
    if (returnAmount > remaining) {
      addNotification("Error: Cannot return more than dispatched.");
      return;
    }

    setDispatches(prev => prev.map(d => 
      d.id === dispatchId ? { ...d, returnedAmount: d.returnedAmount + returnAmount } : d
    ));

    setProducts(prev => prev.map(p => 
      p.id === dispatch.productId ? { ...p, stock: p.stock + returnAmount } : p
    ));

    addNotification(`Success: ${returnAmount} units returned to inventory.`);
  };

  // Dashboard Stats
  const stats = useMemo(() => {
    const totalValue = products.reduce((sum, p) => sum + (p.stock * p.price), 0);
    const outForProjects = dispatches.reduce((sum, d) => sum + (d.amount - d.returnedAmount), 0);
    const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
    
    // Monthly forecast calculation (simulation)
    const monthlyUsage = dispatches.reduce((sum, d) => sum + d.amount, 0);
    
    return { totalValue, outForProjects, lowStockCount, monthlyUsage };
  }, [products, dispatches]);

  const chartData = useMemo(() => {
    // Group by last 7 days or similar
    return products.slice(0, 5).map(p => ({
      name: p.name.split(' ')[0],
      Stock: p.stock,
      Out: dispatches.filter(d => d.productId === p.id).reduce((sum, d) => sum + (d.amount - d.returnedAmount), 0)
    }));
  }, [products, dispatches]);

  return (
    <div className="flex min-h-screen bg-[#0e0f1a] text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 flex flex-col p-6 sticky top-0 h-screen bg-[#0e0f1a] z-20">
        <div className="mb-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-roofing-green rounded-lg shadow-[0_0_15px_rgba(34,197,94,0.4)]"></div>
            <h1 className="font-bold text-lg leading-tight uppercase tracking-wider">
              QUÍMICAS<br />
              <span className="text-roofing-green">UNIDAS</span>
            </h1>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem active={activeTab === 'dashboard'} icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={() => setActiveTab('dashboard')} />
          <NavItem active={activeTab === 'inventory'} icon={<Package size={18} />} label="Inventory" onClick={() => setActiveTab('inventory')} />
          <NavItem active={activeTab === 'dispatch'} icon={<Send size={18} />} label="Project Dispatch" onClick={() => setActiveTab('dispatch')} />
          <NavItem active={activeTab === 'returns'} icon={<RotateCcw size={18} />} label="Surplus Returns" onClick={() => setActiveTab('returns')} />
          <NavItem active={activeTab === 'customers'} icon={<Users size={18} />} label="Customers" onClick={() => setActiveTab('customers')} />
          <NavItem active={activeTab === 'history'} icon={<History size={18} />} label="Movement Log" onClick={() => setActiveTab('history')} />
          <NavItem active={activeTab === 'management'} icon={<Plus size={18} />} label="Management" onClick={() => setActiveTab('management')} />
        </nav>

        <div className="mt-auto">
          <div className="bg-roofing-green/10 border border-roofing-green/30 rounded-2xl p-4">
            <p className="text-[10px] uppercase text-roofing-green font-bold mb-1">Smart Forecast</p>
            <p className="text-xs text-white/70">Projected usage +12% for upcoming hurricane season.</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input 
              type="text" 
              placeholder="Search inventory or project IDs..." 
              className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-roofing-green/50 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold">Admin Panel</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Quimicas PR Dispatch</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-xs">J G</div>
          </div>
        </header>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard stats={stats} chartData={chartData} products={products} />}
            {activeTab === 'inventory' && <Inventory products={products} />}
            {activeTab === 'dispatch' && <ProjectDispatch products={products} projects={projects} employees={employees} onDispatch={handleDispatch} />}
            {activeTab === 'returns' && <SurplusReturns dispatches={dispatches} products={products} onReturn={handleReturn} />}
            {activeTab === 'customers' && <Customers customers={customers} products={products} />}
            {activeTab === 'history' && <MovementLog dispatches={dispatches} products={products} />}
            {activeTab === 'management' && (
              <Management 
                products={products} 
                setProducts={setProducts} 
                projects={projects} 
                setProjects={setProjects}
                employees={employees}
                setEmployees={setEmployees}
                addNotification={addNotification}
                chatMessages={chatMessages}
                handleAiMessage={handleAiMessage}
                isAiTyping={isAiTyping}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Notifications */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-4">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              className={cn(
                "bg-[#0e0f1a] rounded-2xl p-4 flex items-center gap-4 border shadow-[0_0_30px_rgba(34,197,94,0.15)]",
                n.text.toLowerCase().includes('error') || n.text.toLowerCase().includes('warning') 
                  ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.15)]" 
                  : "border-roofing-green"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-inner",
                n.text.toLowerCase().includes('error') || n.text.toLowerCase().includes('warning') 
                  ? "bg-red-500 text-white" 
                  : "bg-roofing-green text-black"
              )}>
                {n.text.toLowerCase().includes('error') || n.text.toLowerCase().includes('warning') ? '!' : '✓'}
              </div>
              <div>
                <p className="text-xs font-bold">
                  {n.text.toLowerCase().includes('error') ? 'Operation Error' : 
                   n.text.toLowerCase().includes('warning') ? 'System Warning' : 'Operation Successful'}
                </p>
                <p className="text-[10px] text-white/40 font-medium">{'Inventory & records synchronized.'}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>


    </div>
  );
}

// Subcomponents
function NavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
        active ? "bg-white/10 border border-white/10 text-white shadow-lg" : "text-white/40 hover:text-white"
      )}
    >
      <span className={cn(
        "transition-colors duration-300", 
        active ? "text-roofing-green" : "group-hover:text-white"
      )}>
        {icon}
      </span>
      <span className="text-sm font-semibold tracking-wide">{label}</span>
      {active && (
        <div className="ml-auto w-1.5 h-1.5 bg-roofing-green rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
      )}
    </button>
  );
}

function StatCard({ label, value, trend, icon, green }: { label: string, value: string, trend?: string, icon: React.ReactNode, green?: boolean }) {
  return (
    <div className="glass rounded-3xl p-6 border border-white/5 relative overflow-hidden group">
      <div className={cn(
        "absolute -right-4 -top-4 w-32 h-32 blur-3xl opacity-10 transition-opacity duration-500 group-hover:opacity-20",
        green ? "bg-roofing-green" : "bg-blue-500"
      )} />
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-white/70 group-hover:text-roofing-green transition-colors">
          {icon}
        </div>
        {trend && (
          <span className="text-xs font-bold text-roofing-green bg-roofing-green/10 px-2 py-1 rounded-lg">
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
        <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
      </div>
    </div>
  );
}

function Dashboard({ stats, chartData, products }: { stats: any, chartData: any[], products: Product[] }) {
  const categoryValuation = useMemo(() => {
    const categories: Record<string, number> = {};
    products.forEach(p => {
      const val = p.stock * p.price;
      categories[p.category] = (categories[p.category] || 0) + val;
    });
    return Object.entries(categories).sort((a, b) => b[1] - a[1]);
  }, [products]);

  return (
    <div className="space-y-8">
      {/* Primary Forecast Box */}
      <div className="bento-card border-roofing-green/30 bg-roofing-green/[0.03] p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2">
          <p className="text-xs text-roofing-green font-black uppercase tracking-[0.2em]">Operational Smart Forecast</p>
          <h2 className="text-5xl font-black tracking-tighter">Optimal <span className="text-roofing-green">Utilization</span></h2>
          <p className="text-white/40 max-w-md text-sm">Based on active project dispatches, inventory levels are stabilized for the next 45 days. No critical backlogs detected.</p>
        </div>
        <div className="flex items-center gap-10">
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-white/30 mb-1">Monthly Usage</p>
            <p className="text-4xl font-mono font-bold text-white">{stats.monthlyUsage}</p>
          </div>
          <div className="w-px h-16 bg-white/10 hidden md:block" />
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-white/30 mb-1">Stock Health</p>
            <p className="text-4xl font-mono font-bold text-roofing-green">98.2%</p>
          </div>
        </div>
      </div>

      {/* Primary Forecast Box */}
      <div className="bento-card border-roofing-green/30 bg-roofing-green/[0.03] p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2">
          <p className="text-xs text-roofing-green font-black uppercase tracking-[0.2em]">Operational Smart Forecast</p>
          <h2 className="text-5xl font-black tracking-tighter">Optimal <span className="text-roofing-green">Utilization</span></h2>
          <p className="text-white/40 max-w-md text-sm">Based on active project dispatches, inventory levels are stabilized for the next 45 days. No critical backlogs detected.</p>
        </div>
        <div className="flex items-center gap-10">
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-white/30 mb-1">Monthly Usage</p>
            <p className="text-4xl font-mono font-bold text-white">{stats.monthlyUsage}</p>
          </div>
          <div className="w-px h-16 bg-white/10 hidden md:block" />
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-white/30 mb-1">Stock Health</p>
            <p className="text-4xl font-mono font-bold text-roofing-green">98.2%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
        {/* Stat 1 */}
        <div className="bento-card flex flex-col justify-between">
          <div>
            <p className="text-xs text-white/40 uppercase font-bold mb-1 tracking-wider">Total Inventory Value</p>
            <h3 className="text-3xl font-bold font-mono tracking-tight">${stats.totalValue.toLocaleString()}</h3>
          </div>
          <div className="text-roofing-green text-sm font-medium">Synced with current pricing</div>
        </div>

        {/* Section Valuation */}
        <div className="lg:col-span-2 bento-card flex flex-col justify-between">
          <p className="text-xs text-white/40 uppercase font-bold mb-4 tracking-wider">Valuation by Category</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categoryValuation.slice(0, 4).map(([cat, val]) => (
              <div key={cat} className="space-y-1">
                <p className="text-[10px] font-bold text-white/20 uppercase truncate">{cat}</p>
                <p className="text-xl font-bold">${val.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Critical Alerts - Row spanning */}
        <div className="lg:row-span-2 bento-card flex flex-col h-full">
          <h4 className="text-xs font-bold uppercase text-white/40 mb-6 tracking-widest">Critical Low Stock</h4>
          <div className="space-y-4 flex-1">
            {products.filter(p => p.stock <= p.minStock).map(p => (
              <div key={p.id} className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <p className="text-sm font-bold">{p.name}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">SKU: {p.sku}</p>
                </div>
                <span className="px-2 py-1 bg-red-500/10 text-red-400 text-[10px] font-bold rounded border border-red-500/30">
                  {p.stock} UNIT
                </span>
              </div>
            ))}
            {products.filter(p => p.stock <= p.minStock).length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-white/10 opacity-50">
                <CheckCircle2 size={40} className="mb-2" />
                <p className="text-xs">Inventory Healthy</p>
              </div>
            )}
          </div>
          <button className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
            Supplies Request
          </button>
        </div>

        {/* Chart - Column Spanning */}
        <div className="lg:col-span-2 lg:row-span-2 bento-card flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold">In-store Sales vs Project usage</h3>
            <div className="flex gap-4 text-[10px] font-black tracking-tighter uppercase text-white/30">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-roofing-green rounded-full shadow-[0_0_5px_rgba(34,197,94,0.4)]"></div>
                <span>Stock</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-white/10 rounded-full"></div>
                <span>Out</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 min-h-[300px]">
            <div className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }}
                    dy={12}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    contentStyle={{ 
                      backgroundColor: '#0e0f1a', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '16px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                    }}
                  />
                  <Bar dataKey="Stock" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="Out" fill="rgba(255,255,255,0.1)" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom status - Smart Recommendation */}
      <div className="bento-card border-none bg-gradient-to-br from-roofing-green/20 to-transparent p-6 flex flex-col justify-center">
        <p className="text-[10px] text-roofing-green font-bold uppercase tracking-widest mb-2">Operational Insight</p>
        <p className="text-sm text-white/80 leading-relaxed">
          Forecasted <span className="text-roofing-green font-bold">+12% demand</span> for <span className="underline decoration-roofing-green/30 underline-offset-4 font-semibold">UltraSeal Pro</span> over next 14 days.
        </p>
      </div>
    </div>
  );
}

function Inventory({ products }: { products: Product[] }) {
  return (
    <div className="glass rounded-3xl overflow-hidden border border-white/5">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-white/5 border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40 font-bold">
            <th className="px-8 py-6">Product Details</th>
            <th className="px-8 py-6">Category</th>
            <th className="px-8 py-6">Current Stock</th>
            <th className="px-8 py-6">Status</th>
            <th className="px-8 py-6 text-right">Unit Price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {products.map(p => (
            <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
              <td className="px-8 py-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 glass rounded-lg flex items-center justify-center text-white/20 group-hover:text-roofing-green transition-colors">
                    <Package size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">{p.name}</h4>
                    <p className="text-xs text-white/40 uppercase font-medium">{p.sku}</p>
                  </div>
                </div>
              </td>
              <td className="px-8 py-6 text-sm text-white/60">{p.category}</td>
              <td className="px-8 py-6 font-mono font-bold text-lg">
                {p.stock} <span className="text-[10px] text-white/30 font-sans tracking-wide ml-1">{p.unit}s</span>
              </td>
              <td className="px-8 py-6">
                <span className={cn(
                  "text-[10px] uppercase font-bold px-2 py-1 rounded-md",
                  p.stock <= p.minStock ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                )}>
                  {p.stock <= p.minStock ? "Critical State" : "In Stock"}
                </span>
              </td>
              <td className="px-8 py-6 text-right font-bold text-sm text-white/80">${p.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectDispatch({ products, projects, employees, onDispatch }: { products: Product[], projects: Project[], employees: Employee[], onDispatch: any }) {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [employee, setEmployee] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !selectedProject || !employee || !amount) return;
    onDispatch(selectedProduct, Number(amount), employee, selectedProject);
    setAmount('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 bento-card relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
           <div className="w-32 h-32 border-4 border-roofing-green rounded-full"></div>
        </div>
        
        <h3 className="text-xl font-bold mb-8">New Project Dispatch</h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block ml-1">Material Selection</label>
              <select 
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                className="w-full bg-[#1e1f2e] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-roofing-green/50 appearance-none"
              >
                <option value="">Select from Master Inventory</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock} units avail)</option>)}
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block ml-1">Authorized Employee</label>
              <select 
                value={employee}
                onChange={e => setEmployee(e.target.value)}
                className="w-full bg-[#1e1f2e] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-roofing-green/50 appearance-none"
              >
                <option value="">Select Staff Member</option>
                {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name} ({emp.role})</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block ml-1">Destination Project</label>
              <select 
                value={selectedProject}
                onChange={e => setSelectedProject(e.target.value)}
                className="w-full bg-[#1e1f2e] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-roofing-green/50 appearance-none"
              >
                <option value="">Choose Registered Site</option>
                {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block ml-1">Dispatch Quantity</label>
              <input 
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Volume to send"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-roofing-green/50" 
              />
            </div>
          </div>

          <div className="md:col-span-2 mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/40 text-[10px] italic font-medium">
              <div className="w-2 h-2 bg-roofing-green rounded-full animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.4)]"></div>
              Transaction auto-logs to ledger on submit
            </div>
            <button className="bg-roofing-green hover:bg-roofing-green/90 text-black font-bold px-10 py-3.5 rounded-xl transition-all shadow-[0_0_25px_rgba(34,197,94,0.3)] hover:-translate-y-1">
              Dispatch Material
            </button>
          </div>
        </form>
      </div>

      <div className="bento-card overflow-hidden">
        <h3 className="text-xs font-bold uppercase text-white/40 mb-6 tracking-widest">Active Site Estimates</h3>
        <div className="space-y-4">
          {projects.map(proj => (
            <div key={proj.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl group hover:border-roofing-green/30 transition-all cursor-default">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold group-hover:text-roofing-green transition-colors">{proj.name}</p>
                <div className="px-2 py-0.5 bg-roofing-green/10 text-roofing-green rounded text-[9px] font-black tracking-widest uppercase">Live</div>
              </div>
              <div className="space-y-2">
                {Object.entries(proj.allocations).slice(0, 2).map(([pid, amt]) => {
                  const p = products.find(x => x.id === pid);
                  return (
                    <div key={pid} className="flex items-center justify-between text-[11px] font-medium border-t border-white/5 pt-2">
                      <span className="text-white/40">{p?.name}</span>
                      <span className="text-white/80">{amt} {p?.unit}s</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SurplusReturns({ dispatches, products, onReturn }: { dispatches: Dispatch[], products: Product[], onReturn: any }) {
  const [selectedDispatch, setSelectedDispatch] = useState('');
  const [returnAmount, setReturnAmount] = useState('');

  const activeDispatches = dispatches.filter(d => d.amount > d.returnedAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispatch || !returnAmount) return;
    onReturn(selectedDispatch, Number(returnAmount));
    setReturnAmount('');
    setSelectedDispatch('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
      <div className="bento-card">
        <div className="flex items-center gap-3 mb-8">
          <RotateCcw className="text-roofing-green" size={24} />
          <h3 className="text-xl font-bold">Surplus Return Log</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block ml-1">Active Dispatches</label>
            <select 
              value={selectedDispatch}
              onChange={e => setSelectedDispatch(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-roofing-green/50 appearance-none"
            >
              <option value="">Select Reference Entry</option>
              {activeDispatches.map(d => {
                const p = products.find(prod => prod.id === d.productId);
                return (
                  <option key={d.id} value={d.id}>
                    {d.projectName} — {p?.name} ({d.amount - d.returnedAmount} kg)
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block ml-1">Return Amount</label>
            <input 
              type="number"
              value={returnAmount}
              onChange={e => setReturnAmount(e.target.value)}
              placeholder="Confirm exact return volume"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-roofing-green/50" 
            />
          </div>

          <button className="w-full mt-4 bg-transparent border border-roofing-green/40 hover:bg-roofing-green/10 text-roofing-green font-bold px-8 py-3.5 rounded-xl transition-all uppercase tracking-widest text-xs">
            Verify & Return to Store
          </button>
        </form>
      </div>

      <div className="bento-card">
        <h4 className="text-xs font-bold uppercase text-white/40 mb-6 tracking-widest">Awaiting Reconcile</h4>
        <div className="space-y-3">
          {activeDispatches.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-white/10 italic">
               <CheckCircle2 size={32} className="mb-2 opacity-50" />
               <p className="text-xs font-medium">All field accounts balanced</p>
            </div>
          )}
          {activeDispatches.map(d => {
            const p = products.find(prod => prod.id === d.productId);
            return (
              <div key={d.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex justify-between items-center group hover:bg-white/[0.08] transition-colors">
                <div className="text-xs">
                  <p className="font-bold text-white/90">{p?.name}</p>
                  <p className="text-white/40 uppercase tracking-tighter text-[9px]">Project: {d.projectName}</p>
                </div>
                <div className="text-right">
                   <p className="text-sm font-black text-roofing-green">{d.amount - d.returnedAmount}</p>
                   <p className="text-[9px] text-white/30 font-bold uppercase">Pending</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Customers({ customers, products }: { customers: Customer[], products: Product[] }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map(c => (
          <div key={c.id} className="glass rounded-3xl p-6 border border-white/5 group hover:border-roofing-green/30 transition-all">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                <Users size={24} className="text-white/40 group-hover:text-roofing-green transition-colors" />
              </div>
              <div>
                <h4 className="font-bold">{c.name}</h4>
                <p className="text-xs text-white/40">{c.email}</p>
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t border-white/5">
              <p className="text-[10px] uppercase font-bold text-white/30 tracking-widest">Recent Purchases</p>
              {c.history.slice(0, 2).map((h, i) => {
                const p = products.find(prod => prod.id === h.productId);
                return (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-white/60">{p?.name}</span>
                    <span className="font-mono font-bold">{h.amount} {p?.unit}s</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <button className="glass rounded-3xl p-6 border border-dashed border-white/10 flex flex-col items-center justify-center gap-4 hover:border-roofing-green/50 group transition-all h-full min-h-[220px]">
          <div className="w-12 h-12 rounded-full border border-dashed border-white/20 flex items-center justify-center group-hover:bg-roofing-green group-hover:border-none transition-all">
            <Plus size={24} className="text-white/20 group-hover:text-[#0e0f1a]" />
          </div>
          <span className="text-sm font-bold text-white/20 group-hover:text-white">Add New Profile</span>
        </button>
      </div>
    </div>
  );
}

function MovementLog({ dispatches, products }: { dispatches: Dispatch[], products: Product[] }) {
  return (
    <div className="glass rounded-3xl overflow-hidden border border-white/5">
      <div className="bg-white/5 p-8 flex items-center justify-between border-b border-white/10">
        <h3 className="text-xl font-bold">Transaction History</h3>
        <div className="flex gap-2">
          <button className="text-[10px] uppercase font-bold px-3 py-1 bg-white/10 rounded-md text-white/60">Export CSV</button>
          <button className="text-[10px] uppercase font-bold px-3 py-1 bg-white/10 rounded-md text-white/60">Print Log</button>
        </div>
      </div>
      <div className="divide-y divide-white/5">
        {dispatches.map(d => {
          const p = products.find(prod => prod.id === d.productId);
          return (
            <div key={d.id} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-6">
                <div className="text-center w-16">
                  <p className="text-xs font-bold">{new Date(d.timestamp).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}</p>
                  <p className="text-[10px] text-white/30 font-bold uppercase">{new Date(d.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                </div>
                <div className="h-10 w-px bg-white/10" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-roofing-green/10 text-roofing-green rounded">Project Dispatch</span>
                    <h4 className="text-sm font-bold">{p?.name}</h4>
                  </div>
                  <p className="text-xs text-white/40">Employee: <span className="text-white/60 font-medium">{d.employeeName}</span> • Site: <span className="text-white/60 font-medium">{d.projectName}</span></p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-mono font-bold text-white/80">-{d.amount} {p?.unit}s</p>
                {d.returnedAmount > 0 && (
                  <p className="text-[10px] text-green-500 font-bold">+{d.returnedAmount} units reconciled</p>
                )}
              </div>
            </div>
          );
        })}
        {dispatches.length === 0 && (
          <div className="py-20 text-center text-white/20">
            <Clock size={48} className="mx-auto mb-4 opacity-20" />
            <p>No movements logged yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Management({ 
  products, 
  setProducts, 
  projects, 
  setProjects,
  employees,
  setEmployees,
  addNotification,
  chatMessages,
  handleAiMessage,
  isAiTyping
}: { 
  products: Product[], 
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>,
  projects: Project[],
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
  employees: Employee[],
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>,
  addNotification: (text: string) => void,
  chatMessages: {role: 'user' | 'model', text: string}[],
  handleAiMessage: (text: string) => Promise<void>,
  isAiTyping: boolean
}) {
  const [mgmtTab, setMgmtTab] = useState<'records' | 'ai'>('records');
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ unit: 'Gallon', price: 0 });
  const [newProject, setNewProject] = useState({ name: '', allocations: {} as Record<string, number> });
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({ name: '', role: '' });
  const [allocationProduct, setAllocationProduct] = useState('');
  const [allocationAmount, setAllocationAmount] = useState('');

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.sku || !newProduct.stock) return;
    const product: Product = {
      id: Math.random().toString(36).substr(2, 9),
      name: newProduct.name,
      sku: newProduct.sku,
      stock: Number(newProduct.stock),
      category: newProduct.category || 'General',
      unit: newProduct.unit || 'Unit',
      price: Number(newProduct.price || 0),
      minStock: Number(newProduct.minStock || 5)
    };
    setProducts(prev => [...prev, product]);
    setNewProduct({ unit: 'Gallon', price: 0 });
    addNotification("Product added to Master Inventory.");
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.name || !newEmployee.role) return;
    const employee: Employee = {
      id: Math.random().toString(36).substr(2, 9),
      name: newEmployee.name,
      role: newEmployee.role
    };
    setEmployees(prev => [...prev, employee]);
    setNewEmployee({ name: '', role: '' });
    addNotification(`Employee ${employee.name} added.`);
  };

  const handleDeleteEmployee = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    addNotification("Employee record removed.");
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    addNotification("Product successfully removed.");
  };

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) return;
    const project: Project = {
      id: Math.random().toString(36).substr(2, 9),
      name: newProject.name,
      allocations: newProject.allocations
    };
    setProjects(prev => [...prev, project]);
    setNewProject({ name: '', allocations: {} });
    addNotification(`Project "${project.name}" registered.`);
  };

  const handleAddAllocation = () => {
    if (!allocationProduct || !allocationAmount) return;
    setNewProject(prev => ({
      ...prev,
      allocations: { ...prev.allocations, [allocationProduct]: Number(allocationAmount) }
    }));
    setAllocationProduct('');
    setAllocationAmount('');
  };

  const handleDeleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    addNotification("Project archived.");
  };

  return (
    <div className="space-y-8">
      {/* Sub-navigation */}
      <div className="flex gap-4 p-1 bg-white/5 w-fit rounded-2xl border border-white/10">
        <button 
          onClick={() => setMgmtTab('records')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            mgmtTab === 'records' ? "bg-roofing-green text-black shadow-lg shadow-roofing-green/20" : "text-white/40 hover:text-white"
          )}
        >
          Records & Entry
        </button>
        <button 
          onClick={() => setMgmtTab('ai')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
            mgmtTab === 'ai' ? "bg-roofing-green text-black shadow-lg shadow-roofing-green/20" : "text-white/40 hover:text-white"
          )}
        >
          <Sparkles size={14} />
          AI Consultant
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mgmtTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {mgmtTab === 'records' ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
              {/* Product Management */}
              <div className="space-y-8">
                <div className="bento-card">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Package size={22} className="text-roofing-green" />
                    Inventory Master Entry
                  </h3>
                  <form onSubmit={handleAddProduct} className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 block ml-1">Product Name</label>
                      <input 
                        value={newProduct.name || ''}
                        onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                        placeholder="Industrial Coating X"
                        className="w-full bg-[#1e1f2e] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-roofing-green/50 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 block ml-1">SKU</label>
                      <input 
                        value={newProduct.sku || ''}
                        onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                        placeholder="SKU-XXXX"
                        className="w-full bg-[#1e1f2e] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-roofing-green/50 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 block ml-1">Intial Stock</label>
                      <input 
                        type="number"
                        value={newProduct.stock || ''}
                        onChange={e => setNewProduct({...newProduct, stock: Number(e.target.value)})}
                        placeholder="0"
                        className="w-full bg-[#1e1f2e] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-roofing-green/50 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 block ml-1">Price per Unit ($)</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={newProduct.price || ''}
                        onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})}
                        placeholder="0.00"
                        className="w-full bg-[#1e1f2e] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-roofing-green/50 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 block ml-1">Category</label>
                      <input 
                        value={newProduct.category || ''}
                        onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                        placeholder="e.g. Sealants"
                        className="w-full bg-[#1e1f2e] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-roofing-green/50 outline-none"
                      />
                    </div>
                    <button className="col-span-2 py-4 bg-white/5 border border-white/10 hover:border-roofing-green/50 text-white font-bold rounded-xl transition-all">
                      Add New Product
                    </button>
                  </form>
                </div>

                <div className="bento-card max-h-[400px] overflow-y-auto">
                  <h4 className="text-xs font-bold uppercase text-white/40 mb-6 tracking-widest">Active Product List</h4>
                  <div className="space-y-3">
                    {products.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl group border border-transparent hover:border-white/10 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#1e1f2e] text-orange-500">
                            <Package size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-bold">{p.name}</p>
                            <p className="text-[10px] text-white/30 uppercase">{p.sku} • ${p.price}/unit</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteProduct(p.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/20 hover:text-red-500 hover:bg-red-500/10 transition-all"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bento-card">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Users size={22} className="text-cyan-400" />
                    Employee Management
                  </h3>
                  <form onSubmit={handleAddEmployee} className="grid grid-cols-2 gap-4 mb-8">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 block ml-1">Staff Name</label>
                      <input 
                        value={newEmployee.name || ''}
                        onChange={e => setNewEmployee({...newEmployee, name: e.target.value})}
                        placeholder="John Doe"
                        className="w-full bg-[#1e1f2e] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-roofing-green/50 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 block ml-1">Role / Job Title</label>
                      <input 
                        value={newEmployee.role || ''}
                        onChange={e => setNewEmployee({...newEmployee, role: e.target.value})}
                        placeholder="Technician"
                        className="w-full bg-[#1e1f2e] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-roofing-green/50 outline-none"
                      />
                    </div>
                    <button className="col-span-2 py-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 font-bold rounded-xl transition-all">
                      Add Employee to System
                    </button>
                  </form>
                  <div className="space-y-3">
                    {employees.map(emp => (
                      <div key={emp.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                            <User size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-bold">{emp.name}</p>
                            <p className="text-[9px] uppercase text-white/30 tracking-wider font-semibold">{emp.role}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteEmployee(emp.id)}
                          className="text-white/10 hover:text-red-500 transition-colors"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Project Management */}
              <div className="space-y-8">
                <div className="bento-card">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <LayoutDashboard size={22} className="text-roofing-green" />
                    Project Registration
                  </h3>
                  <form onSubmit={handleAddProject} className="space-y-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 block ml-1">Official Project Name</label>
                      <input 
                        value={newProject.name}
                        onChange={e => setNewProject({...newProject, name: e.target.value})}
                        placeholder="e.g. San Patricio Plaza Roof"
                        className="w-full bg-[#1e1f2e] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-roofing-green/50 outline-none"
                      />
                    </div>

                    <div className="bg-white/5 rounded-2xl p-5 border border-white/10 shadow-inner">
                      <p className="text-[10px] uppercase font-bold text-white/40 mb-4 tracking-widest">Assign Initial Allocations</p>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <select 
                          value={allocationProduct}
                          onChange={e => setAllocationProduct(e.target.value)}
                          className="bg-[#1e1f2e] border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-roofing-green/50"
                        >
                          <option value="">Select Material</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input 
                          type="number"
                          placeholder="Allocated Amt"
                          value={allocationAmount}
                          onChange={e => setAllocationAmount(e.target.value)}
                          className="bg-[#1e1f2e] border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-roofing-green/50"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={handleAddAllocation}
                        className="w-full py-2 bg-roofing-green/10 text-roofing-green border border-roofing-green/30 rounded-lg text-xs font-bold hover:bg-roofing-green/20 transition-all"
                      >
                        + Add Allocation to Project
                      </button>

                      {Object.keys(newProject.allocations).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                          {Object.entries(newProject.allocations).map(([pid, amt]) => {
                            const p = products.find(prod => prod.id === pid);
                            return (
                              <div key={pid} className="flex justify-between text-[11px] font-medium text-white/60">
                                <span>{p?.name}</span>
                                <span className="text-white/80">{amt} Units</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button className="w-full py-4 bg-roofing-green text-black font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:scale-[1.02] active:scale-[0.98]">
                      Register Project Site
                    </button>
                  </form>
                </div>

                <div className="bento-card">
                  <h4 className="text-xs font-bold uppercase text-white/40 mb-6 tracking-widest">Registered Active Projects</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projects.map(pj => (
                      <div key={pj.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between group hover:border-white/20 transition-all">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-bold group-hover:text-roofing-green transition-colors">{pj.name}</p>
                          <button 
                            onClick={() => handleDeleteProject(pj.id)}
                            className="text-white/10 hover:text-red-500 transition-colors"
                          >
                            <XCircle size={16} />
                          </button>
                        </div>
                        <p className="text-[10px] text-white/30 uppercase font-bold">
                          {Object.keys(pj.allocations).length} Materials Allocated
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto h-[600px] bg-[#1e1f2e] border border-white/10 rounded-[40px] flex flex-col overflow-hidden shadow-2xl relative">
              {/* Decorative background glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-roofing-green/5 blur-[100px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-roofing-green/5 blur-[100px] pointer-events-none" />

              {/* Chat Header */}
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-roofing-green flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                    <Bot size={24} className="text-black" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight">AI Logistics Strategist</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-roofing-green animate-pulse" />
                      <span className="text-[10px] text-roofing-green font-black uppercase tracking-widest">Real-time Data Active</span>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Model: GEMINI-3-PRO</p>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                {chatMessages.map((m, idx) => (
                  <div key={idx} className={cn("flex gap-5", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg",
                      m.role === 'user' ? "bg-white/5 text-white/40 border border-white/10" : "bg-[#0e0f1a] text-roofing-green border border-roofing-green/20"
                    )}>
                      {m.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                    </div>
                    <div className={cn(
                      "max-w-[80%] p-6 rounded-[28px] text-[14px] leading-relaxed relative",
                      m.role === 'user' 
                        ? "bg-white/5 border border-white/5 text-white rounded-tr-none shadow-sm" 
                        : "bg-[#0e0f1a] border border-white/10 text-white/90 rounded-tl-none shadow-xl"
                    )}>
                      {m.text}
                      {/* Message tail overlay */}
                      <div className={cn(
                        "absolute top-0 w-4 h-4",
                        m.role === 'user' ? "-right-2 bg-white/5 clip-path-msg-right" : "-left-2 bg-[#0e0f1a] clip-path-msg-left"
                      )} />
                    </div>
                  </div>
                ))}
                {isAiTyping && (
                  <div className="flex gap-5">
                    <div className="w-10 h-10 rounded-xl bg-[#0e0f1a] border border-roofing-green/20 text-roofing-green flex items-center justify-center animate-pulse">
                      <Sparkles size={18} />
                    </div>
                    <div className="bg-[#0e0f1a] border border-white/10 p-6 rounded-[28px] rounded-tl-none shadow-xl">
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 bg-roofing-green rounded-full animate-bounce delay-0" />
                        <div className="w-1.5 h-1.5 bg-roofing-green rounded-full animate-bounce delay-150" />
                        <div className="w-1.5 h-1.5 bg-roofing-green rounded-full animate-bounce delay-300" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-8 bg-white/[0.02] border-t border-white/5">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem('chatInput') as HTMLInputElement;
                    if (!input.value.trim()) return;
                    handleAiMessage(input.value);
                    input.value = '';
                  }}
                  className="relative group"
                >
                  <input 
                    name="chatInput"
                    placeholder="Ask about inventory forecasts, project bottlenecks, or material analysis..."
                    className="w-full bg-[#0e0f1a] border border-white/10 rounded-[28px] px-8 py-5 text-sm focus:outline-none focus:border-roofing-green/40 pr-16 transition-all shadow-2xl group-hover:border-white/20"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-roofing-green text-black rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-roofing-green/30">
                    <Send size={20} />
                  </button>
                </form>
                <div className="mt-4 flex justify-center gap-6">
                  <p className="text-[9px] uppercase font-bold text-white/20 tracking-[0.2em]">Contextual Analysis Prompt</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

