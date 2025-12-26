import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Trash2, Users, Receipt, DollarSign, Wallet, Check, X, HelpCircle, CheckCircle2, Circle, Printer, ListTodo, Share2, Calendar, Link as LinkIcon, DownloadCloud, Coins, FileDown, Save, Copy, Table2, Calculator, Cloud, CloudCog, Loader2, LogIn, UserCircle2, LogOut } from 'lucide-react';
import { Card, Button, Input, Select } from './components/ui';
import { CATEGORY_ICONS, CATEGORY_COLORS, TASK_ICONS } from './constants';
import { Participant, Expense, ExpenseCategory, CalculationResult, Task, TaskType } from './types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import LZString from 'lz-string';

// Utility for formatting currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// --- API Service for KVDB (More reliable CORS) ---
// Using the public 'beta' bucket for demonstration.
// In a real production app, you would use a private bucket ID.
const KVDB_BUCKET = "beta"; 
const KVDB_API_BASE = `https://kvdb.io/${KVDB_BUCKET}`;

export default function App() {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'expenses' | 'tasks' | 'summary'>('expenses');
  const [tripDuration, setTripDuration] = useState<number>(3);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Cloud / Auth State
  const [cloudId, setCloudId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentUser, setCurrentUser] = useState<{name: string, photo?: string} | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Participant Form
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantType, setNewParticipantType] = useState<'normal' | 'fixed'>('normal');
  const [newParticipantFixedAmount, setNewParticipantFixedAmount] = useState('');
  const [newParticipantPrepaid, setNewParticipantPrepaid] = useState('');
  const [newParticipantDays, setNewParticipantDays] = useState('');

  // Expense Form
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseCategory>(ExpenseCategory.FOOD);
  const [selectedParticipantsForExpense, setSelectedParticipantsForExpense] = useState<string[]>([]);

  // Task Form
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskType, setNewTaskType] = useState<TaskType>(TaskType.CLEANING);
  const [newTaskParticipantId, setNewTaskParticipantId] = useState('');

  // --- Initialization Logic ---
  useEffect(() => {
    // 1. Check for stored user
    const storedUser = localStorage.getItem('tripSplitUser');
    if (storedUser) {
        try {
            setCurrentUser(JSON.parse(storedUser));
        } catch(e) { console.error(e); }
    }

    // 2. Check for URL Data
    const searchParams = new URLSearchParams(window.location.search);
    const tripId = searchParams.get('trip');
    const hash = window.location.hash.slice(1);

    if (tripId) {
      // MODE 1: CLOUD SYNC
      setCloudId(tripId);
      loadFromCloud(tripId);
    } else if (hash) {
      // MODE 2: LEGACY HASH (Offline)
      try {
        let decodedStr = null;
        decodedStr = LZString.decompressFromEncodedURIComponent(hash);
        if (!decodedStr) {
           try { decodedStr = atob(decodeURIComponent(hash)); } catch (e) { }
        }
        if (decodedStr) {
          const decoded = JSON.parse(decodedStr);
          loadData(decoded);
        }
      } catch (e) {
        console.error("Failed to load hash data", e);
      }
    }
  }, []);

  // Mark unsaved changes when data changes
  useEffect(() => {
    if (participants.length > 0 || expenses.length > 0) {
        setHasUnsavedChanges(true);
    }
  }, [participants, expenses, tasks, tripDuration]);

  // Set default days
  useEffect(() => {
    setNewParticipantDays(tripDuration.toString());
  }, [tripDuration]);

  const loadData = (data: any) => {
    if (data.participants) setParticipants(data.participants);
    if (data.expenses) setExpenses(data.expenses);
    if (data.tasks) setTasks(data.tasks);
    if (data.tripDuration) setTripDuration(data.tripDuration);
    // Important: When loading data, we start "clean"
    setHasUnsavedChanges(false);
  };

  // --- Cloud Logic (KVDB) ---

  const loadFromCloud = async (id: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch(`${KVDB_API_BASE}/${id}`);
      if (response.ok) {
        const data = await response.json();
        loadData(data);
        setLastSaved(new Date());
      } else if (response.status === 404) {
         // New ID or expired
         alert("Não encontramos dados para este link. Pode ser uma nova viagem.");
      } else {
        throw new Error("Erro na resposta da API");
      }
    } catch (error) {
      console.error("Cloud Load Error", error);
      alert("Erro de conexão ao carregar dados. Verifique sua internet.");
    } finally {
      setIsSyncing(false);
    }
  };

  const saveToCloud = async () => {
    // If no ID exists, create one first
    const targetId = cloudId || crypto.randomUUID();
    
    setIsSyncing(true);
    const data = { tripDuration, participants, expenses, tasks, lastUpdated: new Date().toISOString() };
    
    try {
      // KVDB uses POST to update/create key-values
      const response = await fetch(`${KVDB_API_BASE}/${targetId}`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        
        // If this was a new session, update URL
        if (!cloudId) {
            setCloudId(targetId);
            const newUrl = `${window.location.pathname}?trip=${targetId}`;
            window.history.pushState({ path: newUrl }, '', newUrl);
            alert("Viagem salva na nuvem! O link foi gerado e atualizado na barra de endereço.");
        }
      } else {
        alert("Erro ao salvar na nuvem. Tente novamente.");
      }
    } catch (error) {
      console.error("Save Error", error);
      alert("Erro de conexão ao salvar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const createCloudSession = () => {
      // Just calls save, which handles creation if ID is null
      saveToCloud();
  };

  // --- Calculations ---
  const calculationResults = useMemo<CalculationResult[]>(() => {
    const fixedParticipants = participants.filter(p => p.isFixed);
    const normalParticipants = participants.filter(p => !p.isFixed);
    const totalFixedContribution = fixedParticipants.reduce((acc, p) => acc + p.fixedContribution, 0);
    const resultsMap = new Map<string, CalculationResult>();
    
    normalParticipants.forEach(p => {
      resultsMap.set(p.id, {
        participantId: p.id,
        participantName: p.name,
        rawShare: 0,
        discount: 0,
        finalAmount: 0,
        prepaidAmount: p.prepaidAmount || 0,
        remainingAmount: 0,
        isFixed: false,
        isPaid: p.isPaid,
        days: p.stayDays
      });
    });

    expenses.forEach(expense => {
      const manualDist: Record<string, number> = expense.manualDistributions || {};
      const manualIds = Object.keys(manualDist);
      const manualTotal = Object.values(manualDist).reduce((sum, val) => sum + val, 0);

      const involvedNormalParticipants = expense.participantIds
        .map(id => normalParticipants.find(p => p.id === id))
        .filter((p): p is Participant => !!p);

      const autoParticipants = involvedNormalParticipants.filter(p => !manualIds.includes(p.id));
      const remainingExpenseAmount = Math.max(0, expense.amount - manualTotal);

      manualIds.forEach(pid => {
        if (resultsMap.has(pid)) {
          const current = resultsMap.get(pid);
          if (current) current.rawShare += manualDist[pid];
        }
      });

      if (autoParticipants.length > 0 && remainingExpenseAmount > 0) {
        const totalPersonDays = autoParticipants.reduce((acc, p) => acc + (p.stayDays || 1), 0);
        
        if (totalPersonDays === 0) {
           const splitEqual = remainingExpenseAmount / autoParticipants.length;
           autoParticipants.forEach(p => {
             const current = resultsMap.get(p.id);
             if (current) current.rawShare += splitEqual;
           });
        } else {
           autoParticipants.forEach(p => {
             const personWeight = (p.stayDays || 1) / totalPersonDays;
             const personShare = remainingExpenseAmount * personWeight;
             const current = resultsMap.get(p.id);
             if (current) current.rawShare += personShare;
           });
        }
      }
    });

    const discountPerPerson = normalParticipants.length > 0 
      ? totalFixedContribution / normalParticipants.length 
      : 0;

    normalParticipants.forEach(p => {
      const current = resultsMap.get(p.id);
      if (current) {
        current.discount = discountPerPerson;
        const totalShare = Math.max(0, current.rawShare - current.discount);
        current.finalAmount = totalShare;
        current.remainingAmount = totalShare - current.prepaidAmount;
      }
    });

    const fixedResults: CalculationResult[] = fixedParticipants.map(p => {
      const totalShare = p.fixedContribution;
      const prepaid = p.prepaidAmount || 0;
      return {
        participantId: p.id,
        participantName: p.name,
        rawShare: totalShare,
        discount: 0,
        finalAmount: totalShare,
        prepaidAmount: prepaid,
        remainingAmount: totalShare - prepaid,
        isFixed: true,
        isPaid: p.isPaid,
        days: p.stayDays
      };
    });

    return [...Array.from(resultsMap.values()), ...fixedResults];
  }, [participants, expenses]);

  const totalTripCost = useMemo(() => expenses.reduce((acc, e) => acc + e.amount, 0), [expenses]);
  const totalPaid = useMemo(() => calculationResults.reduce((acc, r) => {
    if (r.isPaid) return acc + r.finalAmount;
    return acc + r.prepaidAmount;
  }, 0), [calculationResults]);

  // --- Helpers for Summary Matrix ---
  const getExpenseShareForParticipant = (expense: Expense, participantId: string): { value: number, isManual: boolean } => {
    if (expense.manualDistributions && expense.manualDistributions[participantId] !== undefined) {
      return { value: expense.manualDistributions[participantId], isManual: true };
    }
    if (!expense.participantIds.includes(participantId)) return { value: 0, isManual: false };

    const normalParticipants = participants.filter(p => !p.isFixed);
    const involvedNormalParticipants = expense.participantIds
        .map(id => normalParticipants.find(p => p.id === id))
        .filter((p): p is Participant => !!p);
    
    const manualDist: Record<string, number> = expense.manualDistributions || {};
    const manualIds = Object.keys(manualDist);
    const manualTotal = Object.values(manualDist).reduce((a,b) => a+b, 0);
    const remainingAmount = Math.max(0, expense.amount - manualTotal);

    const autoParticipants = involvedNormalParticipants.filter(p => !manualIds.includes(p.id));
    const me = autoParticipants.find(p => p.id === participantId);
    if (!me) return { value: 0, isManual: false };

    const totalPersonDays = autoParticipants.reduce((acc, p) => acc + (p.stayDays || 1), 0);
    if (totalPersonDays === 0) return { value: remainingAmount / autoParticipants.length, isManual: false };

    const weight = (me.stayDays || 1) / totalPersonDays;
    return { value: remainingAmount * weight, isManual: false };
  };

  // --- Handlers ---
  const handleUpdateExpenseDistribution = (expenseId: string, participantId: string, valueStr: string) => {
    setExpenses(prev => prev.map(exp => {
      if (exp.id !== expenseId) return exp;
      const newManuals = { ...(exp.manualDistributions || {}) };
      if (valueStr === '') { delete newManuals[participantId]; } 
      else {
        const val = parseFloat(valueStr);
        if (!isNaN(val) && val >= 0) { newManuals[participantId] = val; }
      }
      const newParticipantIds = exp.participantIds.includes(participantId) ? exp.participantIds : [...exp.participantIds, participantId];
      return { ...exp, manualDistributions: newManuals, participantIds: newParticipantIds };
    }));
  };

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipantName.trim()) return;
    const days = parseInt(newParticipantDays) || tripDuration;
    const prepaid = parseFloat(newParticipantPrepaid) || 0;
    const newPerson: Participant = {
      id: crypto.randomUUID(),
      name: newParticipantName.trim(),
      isFixed: newParticipantType === 'fixed',
      fixedContribution: newParticipantType === 'fixed' ? parseFloat(newParticipantFixedAmount) || 0 : 0,
      isPaid: false,
      stayDays: days,
      prepaidAmount: prepaid
    };
    setParticipants(prev => [...prev, newPerson]);
    setNewParticipantName('');
    setNewParticipantType('normal');
    setNewParticipantFixedAmount('');
    setNewParticipantPrepaid('');
    setNewParticipantDays(tripDuration.toString());
    if (!newPerson.isFixed) setSelectedParticipantsForExpense(prev => [...prev, newPerson.id]);
  };

  const handleDeleteParticipant = (id: string) => {
    if (confirm('Tem certeza?')) {
      setParticipants(prev => prev.filter(p => p.id !== id));
      setExpenses(prev => prev.map(e => ({ ...e, participantIds: e.participantIds.filter(pid => pid !== id) })));
      setTasks(prev => prev.filter(t => t.participantId !== id));
      setSelectedParticipantsForExpense(prev => prev.filter(pid => pid !== id));
    }
  };

  const handleUpdateParticipantDays = (id: string, newDays: string) => {
    const days = parseInt(newDays);
    if (isNaN(days) || days < 0) return;
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, stayDays: days } : p));
  };

  const handleUpdateParticipantPrepaid = (id: string, amountStr: string) => {
    if (amountStr === '') { setParticipants(prev => prev.map(p => p.id === id ? { ...p, prepaidAmount: 0 } : p)); return; }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount < 0) return;
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, prepaidAmount: amount } : p));
  };

  const togglePaymentStatus = (id: string) => {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, isPaid: !p.isPaid } : p));
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newExpenseAmount);
    if (!newExpenseName.trim() || isNaN(amount) || amount <= 0) return;
    if (selectedParticipantsForExpense.length === 0) { alert("Selecione pelo menos um participante."); return; }
    const newExpense: Expense = {
      id: crypto.randomUUID(),
      name: newExpenseName.trim(),
      amount,
      category: newExpenseCategory,
      participantIds: selectedParticipantsForExpense
    };
    setExpenses(prev => [...prev, newExpense]);
    setNewExpenseName('');
    setNewExpenseAmount('');
    setNewExpenseCategory(ExpenseCategory.FOOD);
  };

  const handleDeleteExpense = (id: string) => { setExpenses(prev => prev.filter(e => e.id !== id)); };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskParticipantId) return;
    const newTask: Task = {
      id: crypto.randomUUID(),
      name: newTaskName.trim() || newTaskType,
      type: newTaskType,
      participantId: newTaskParticipantId
    };
    setTasks(prev => [...prev, newTask]);
    setNewTaskName('');
  };

  const handleDeleteTask = (id: string) => { setTasks(prev => prev.filter(t => t.id !== id)); };

  const toggleParticipantSelection = (id: string) => {
    setSelectedParticipantsForExpense(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
  };

  const selectAllParticipants = () => {
    const normalIds = participants.filter(p => !p.isFixed).map(p => p.id);
    setSelectedParticipantsForExpense(normalIds);
  };

  // --- Auth Simulation ---
  const handleSimulatedLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    
    if (name) {
        const user = {
            name,
            photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
        };
        setCurrentUser(user);
        // Persist session
        localStorage.setItem('tripSplitUser', JSON.stringify(user));
        setShowLoginModal(false);
    }
  };

  const handleLogout = () => {
      setCurrentUser(null);
      localStorage.removeItem('tripSplitUser');
  };

  // --- PDF ---
  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    const element = document.getElementById('report-content');
    if (!element) { setIsGeneratingPdf(false); return; }
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, windowWidth: 1200 });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      pdf.save(`TripSplit-Relatorio-${new Date().toLocaleDateString()}.pdf`);
    } catch (error) { console.error("PDF Error:", error); alert("Erro ao gerar PDF."); } finally { setIsGeneratingPdf(false); }
  };

  // --- Sharing ---
  const handleShare = () => {
    if (!cloudId) {
        // Fallback to Hash if not in cloud
        const data = { tripDuration, participants, expenses, tasks };
        const json = JSON.stringify(data);
        const encoded = LZString.compressToEncodedURIComponent(json);
        const url = `${window.location.origin}${window.location.pathname}#${encoded}`;
        navigator.clipboard.writeText(url);
        alert("Link local copiado! Atenção: Para sincronizar alterações com outros aparelhos, clique em 'Conectar Nuvem'.");
    } else {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        alert("Link de Sincronização copiado! Qualquer pessoa com este link verá as alterações que você Salvar.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 print:bg-white print:pb-0 font-sans">
      
      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
                <div className="text-center mb-6">
                    <div className="mx-auto w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                        <UserCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Entrar com Google</h2>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">Simulação de Ambiente</p>
                    <p className="text-sm text-slate-600 mt-2">Como não temos servidor, digite seu nome para se identificar na sessão. Isso ficará salvo neste navegador.</p>
                </div>
                <form onSubmit={handleSimulatedLogin} className="space-y-4">
                    <Input name="name" label="Seu Nome" placeholder="Ex: João Silva" autoFocus />
                    <Button className="w-full bg-blue-600 hover:bg-blue-700" type="submit">
                        Entrar e Conectar
                    </Button>
                    <button type="button" onClick={() => setShowLoginModal(false)} className="w-full text-sm text-slate-400 hover:text-slate-600 mt-2">
                        Cancelar
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Header (Navbar) */}
      <header className={`bg-primary text-white shadow-lg sticky top-0 z-10 print:hidden ${isGeneratingPdf ? 'hidden' : 'block'}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-4">
          
          {/* Top Row: Logo & User Actions */}
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-xl">
                    <Wallet className="w-6 h-6 text-secondary" />
                </div>
                <div>
                    <h1 className="text-xl font-bold leading-tight">TripSplit</h1>
                    {cloudId && <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-100 border border-emerald-500/30 flex items-center gap-1 w-fit"><Cloud className="w-3 h-3"/> Nuvem Ativa</span>}
                </div>
             </div>

             <div className="flex items-center gap-2">
                {currentUser ? (
                    <div className="flex items-center gap-2 bg-black/20 pl-3 pr-1 py-1 rounded-full">
                        <span className="text-sm font-medium">{currentUser.name}</span>
                        <img src={currentUser.photo} alt={currentUser.name} className="w-7 h-7 rounded-full border border-white/30" />
                        <button onClick={handleLogout} className="ml-2 text-white/50 hover:text-white p-1" title="Sair"><LogOut className="w-4 h-4"/></button>
                    </div>
                ) : (
                    <Button size="sm" onClick={() => setShowLoginModal(true)} className="bg-white text-primary hover:bg-slate-100 font-bold border-none shadow-none">
                        <LogIn className="w-4 h-4 mr-2" />
                        Entrar com Google
                    </Button>
                )}
             </div>
          </div>

          {/* Bottom Row: Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
            <div className="hidden md:block">
              <p className="text-xs text-teal-200 uppercase font-semibold tracking-wider">Custo Total</p>
              <p className="font-bold text-xl">{formatCurrency(totalTripCost)}</p>
            </div>
            
            <div className="flex items-center gap-2 flex-1 justify-end">
                {cloudId ? (
                     <div className="flex items-center gap-2">
                        <span className={`text-xs flex items-center gap-1 ${hasUnsavedChanges ? 'text-amber-300' : 'text-emerald-300'}`}>
                            {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <div className={`w-2 h-2 rounded-full ${hasUnsavedChanges ? 'bg-amber-400' : 'bg-emerald-400'}`} />}
                            {isSyncing ? 'Sincronizando...' : (hasUnsavedChanges ? 'Alterações não salvas' : 'Sincronizado')}
                        </span>
                        <Button 
                            variant={hasUnsavedChanges ? "secondary" : "primary"}
                            size="sm" 
                            onClick={saveToCloud} 
                            disabled={isSyncing}
                            className={`min-w-[120px] ${hasUnsavedChanges ? 'animate-pulse ring-2 ring-amber-400' : 'bg-teal-800/50'}`}
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {hasUnsavedChanges ? "Salvar Agora" : "Salvo"}
                        </Button>
                     </div>
                ) : (
                    <Button variant="secondary" size="sm" onClick={createCloudSession} disabled={isSyncing} title="Criar link persistente">
                        <CloudCog className="w-4 h-4 mr-2" />
                        Conectar Nuvem
                    </Button>
                )}

                <Button variant="success" size="sm" onClick={handleShare} title="Copiar Link para Compartilhar">
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Link
                </Button>
                
                <Button variant="ghost" size="sm" onClick={handleDownloadPDF} className="text-teal-100 hover:text-white hover:bg-white/10 hidden sm:inline-flex">
                    <FileDown className="w-4 h-4" />
                </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Wrapper for PDF Capture */}
      <div id="report-content" className="bg-slate-50 print:bg-white">
        
        {/* Print Header (Visible only in Print or PDF Generation) */}
        <div className={`${isGeneratingPdf ? 'block' : 'hidden print:block'} text-center py-8 border-b border-slate-200 mb-6 bg-white`}>
            <h1 className="text-4xl font-bold text-slate-900">Relatório da Viagem</h1>
            <p className="text-xl text-slate-500 mt-2">TripSplit - Divisão de Custos e Tarefas</p>
            <div className="flex justify-center gap-8 mt-4 text-slate-600">
            <span className="flex items-center gap-2"><Calendar className="w-4 h-4"/> {tripDuration} dias de viagem</span>
            <span className="flex items-center gap-2"><Users className="w-4 h-4"/> {participants.length} pessoas</span>
            <span className="flex items-center gap-2"><DollarSign className="w-4 h-4"/> Total: {formatCurrency(totalTripCost)}</span>
            </div>
        </div>

        <main className="max-w-6xl mx-auto px-4 py-8">
            
            {/* Global Configuration (Trip Duration) */}
            <div className={`mb-8 print:hidden ${isGeneratingPdf ? 'hidden' : 'block'}`}>
                <Card className="bg-gradient-to-r from-slate-800 to-slate-700 text-white border-none shadow-lg">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 p-3 rounded-full">
                        <Calendar className="w-8 h-8 text-teal-300" />
                        </div>
                        <div>
                        <h2 className="text-xl font-bold">Configuração da Viagem</h2>
                        <p className="text-slate-300 text-sm">Defina a duração para calcular o peso das despesas.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/10">
                        <label className="text-sm font-medium whitespace-nowrap px-2">Total de Dias:</label>
                        <input 
                        type="number" 
                        min="1"
                        value={tripDuration}
                        onChange={(e) => setTripDuration(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 bg-white text-slate-900 rounded px-3 py-1 font-bold text-center outline-none focus:ring-2 focus:ring-secondary"
                        />
                    </div>
                </div>
                </Card>
            </div>

            {/* Tabs (Hidden in PDF) */}
            <div className={`flex gap-3 mb-8 print:hidden overflow-x-auto pb-2 ${isGeneratingPdf ? 'hidden' : 'flex'}`}>
            <button 
                onClick={() => setActiveTab('expenses')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-lg transition-all ${
                activeTab === 'expenses' 
                ? 'bg-white text-primary shadow-md ring-1 ring-slate-200 translate-y-[-2px]' 
                : 'text-slate-500 hover:bg-slate-100'
                }`}
            >
                <DollarSign className="w-6 h-6" /> Despesas & Pessoas
            </button>
            <button 
                onClick={() => setActiveTab('tasks')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-lg transition-all ${
                activeTab === 'tasks' 
                ? 'bg-white text-primary shadow-md ring-1 ring-slate-200 translate-y-[-2px]' 
                : 'text-slate-500 hover:bg-slate-100'
                }`}
            >
                <ListTodo className="w-6 h-6" /> Tarefas
            </button>
            <button 
                onClick={() => setActiveTab('summary')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-lg transition-all ${
                activeTab === 'summary' 
                ? 'bg-white text-primary shadow-md ring-1 ring-slate-200 translate-y-[-2px]' 
                : 'text-slate-500 hover:bg-slate-100'
                }`}
            >
                <Table2 className="w-6 h-6" /> Planilha Detalhada
            </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* LEFT COLUMN: Inputs & Management */}
            <div className={`xl:col-span-7 space-y-8 ${activeTab === 'summary' ? 'xl:col-span-12' : ''} print:hidden ${isGeneratingPdf ? 'hidden' : 'block'}`}>
                
                {/* --- MATRIX / SPREADSHEET TAB --- */}
                {activeTab === 'summary' && (
                  <Card title="Detalhamento e Edição de Gastos (Quem paga o quê)" action={<Calculator className="w-6 h-6 text-slate-400"/>} className="overflow-hidden">
                    {expenses.length === 0 || participants.length === 0 ? (
                      <div className="text-center py-10 text-slate-500">
                         <Table2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                         <p>Adicione participantes e despesas primeiro para ver a planilha.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto pb-4">
                        <div className="inline-block min-w-full align-middle">
                          <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                            <thead>
                              <tr className="bg-slate-50">
                                <th scope="col" className="sticky left-0 z-10 bg-slate-50 py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 border-b border-r border-slate-200 shadow-sm min-w-[150px]">
                                  Participante
                                </th>
                                {expenses.map(expense => (
                                  <th key={expense.id} scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 border-b border-slate-200 min-w-[120px]">
                                    <div className="flex flex-col">
                                      <span>{expense.name}</span>
                                      <span className="text-xs font-normal text-slate-500">{formatCurrency(expense.amount)}</span>
                                    </div>
                                  </th>
                                ))}
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 border-b border-l border-slate-200 bg-slate-50 min-w-[120px]">
                                  Total Cota
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {participants.filter(p => !p.isFixed).map((person) => (
                                <tr key={person.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="sticky left-0 z-10 bg-white py-3 pl-4 pr-3 text-sm font-medium text-slate-900 border-r border-slate-200 shadow-sm whitespace-nowrap">
                                    {person.name}
                                    <span className="block text-xs font-normal text-slate-400">{person.stayDays} dias</span>
                                  </td>
                                  {expenses.map((expense) => {
                                    const { value, isManual } = getExpenseShareForParticipant(expense, person.id);
                                    return (
                                      <td key={`${expense.id}-${person.id}`} className="px-1 py-1 whitespace-nowrap border-r border-slate-100 last:border-0 relative group">
                                         <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">R$</span>
                                            <input
                                              type="number"
                                              step="0.01"
                                              className={`block w-full rounded-md border-0 py-1.5 pl-7 pr-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 transition-all ${
                                                isManual 
                                                ? 'bg-blue-50 text-blue-700 font-bold ring-blue-200' 
                                                : 'bg-transparent text-slate-500 ring-transparent group-hover:ring-slate-200 hover:bg-slate-50'
                                              }`}
                                              value={isManual ? value : parseFloat(value.toFixed(2))}
                                              placeholder="0.00"
                                              onChange={(e) => handleUpdateExpenseDistribution(expense.id, person.id, e.target.value)}
                                            />
                                         </div>
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-slate-900 border-l border-slate-200 bg-slate-50">
                                     {formatCurrency(calculationResults.find(r => r.participantId === person.id)?.rawShare || 0)}
                                  </td>
                                </tr>
                              ))}
                              {/* Total Row */}
                              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                <td className="sticky left-0 z-10 bg-slate-100 py-3 pl-4 pr-3 text-sm text-slate-900 border-r border-slate-300 border-t border-slate-300">
                                  TOTAL GASTO
                                </td>
                                {expenses.map(expense => (
                                  <td key={expense.id} className="px-3 py-3 whitespace-nowrap text-sm text-slate-900 border-t border-slate-300">
                                    {formatCurrency(expense.amount)}
                                  </td>
                                ))}
                                <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-900 border-l border-slate-300 border-t border-slate-300">
                                  {formatCurrency(totalTripCost)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-4 text-xs text-slate-500 flex flex-wrap gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div>
                            <span>Valor Editado Manualmente (Fixo)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-white border border-slate-200 rounded"></div>
                            <span>Valor Calculado Automaticamente (Proporcional aos Dias)</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                )}
                
                {/* --- STANDARD EXPENSE TABS --- */}
                {activeTab === 'expenses' && (
                <>
                    {/* 1. Add Participants */}
                    <Card title="Adicionar Participante" action={<Users className="w-6 h-6 text-slate-400"/>}>
                    <form onSubmit={handleAddParticipant} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-6">
                            <Input 
                            label="Nome"
                            placeholder="Nome do amigo" 
                            value={newParticipantName}
                            onChange={(e) => setNewParticipantName(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-6">
                            <Select 
                            label="Tipo"
                            value={newParticipantType}
                            onChange={(e) => setNewParticipantType(e.target.value as 'normal' | 'fixed')}
                            >
                            <option value="normal">Divisão Padrão</option>
                            <option value="fixed">Convidado (Valor Fixo)</option>
                            </Select>
                        </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <Input 
                                    label="Dias de Estadia"
                                    type="number"
                                    min="1"
                                    max={tripDuration}
                                    value={newParticipantDays}
                                    onChange={(e) => setNewParticipantDays(e.target.value)}
                                    prefix={<Calendar className="w-4 h-4"/>}
                                />
                                <p className="text-sm text-slate-500 mt-2">
                                    Participa de {newParticipantDays || tripDuration} de {tripDuration} dias.
                                </p>
                            </div>

                            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                <Input 
                                    label="Valor já pago (Opcional)"
                                    type="number" 
                                    step="0.01"
                                    placeholder="0,00"
                                    value={newParticipantPrepaid}
                                    onChange={(e) => setNewParticipantPrepaid(e.target.value)}
                                    prefix="R$"
                                />
                                <p className="text-sm text-emerald-700 mt-2">
                                    Adiantamentos ou depósitos.
                                </p>
                            </div>
                            
                            {newParticipantType === 'fixed' && (
                            <div className="col-span-1 md:col-span-2 bg-amber-50 p-3 rounded-lg border border-amber-100 animate-in fade-in">
                                <Input 
                                label="Contribuição Fixa"
                                type="number" 
                                step="0.01"
                                placeholder="0,00"
                                value={newParticipantFixedAmount}
                                onChange={(e) => setNewParticipantFixedAmount(e.target.value)}
                                prefix="R$"
                                />
                                <p className="text-sm text-amber-700 mt-2">
                                Valor único, não entra na divisão por dias.
                                </p>
                            </div>
                            )}
                        </div>

                        <Button type="submit" className="w-full" size="lg" disabled={!newParticipantName}>
                        <Plus className="w-5 h-5 mr-2" /> Adicionar Participante
                        </Button>
                    </form>

                    {/* List of Participants */}
                    <div className="mt-8">
                        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Participantes Atuais</h4>
                        <div className="flex flex-wrap gap-3">
                        {participants.length === 0 && (
                            <p className="text-slate-400 w-full text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">Nenhum participante adicionado.</p>
                        )}
                        {participants.map(p => (
                            <div key={p.id} className={`group flex items-center gap-3 pl-4 pr-2 py-2 rounded-xl border shadow-sm transition-all ${p.isFixed ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-white border-slate-200 text-slate-700'}`}>
                            <div>
                                <span className="font-bold block">{p.name}</span>
                                <span className="text-xs opacity-70 flex flex-wrap items-center gap-x-2">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3"/> 
                                    {/* Editable Stay Days Input */}
                                    {p.isFixed ? (
                                        <span>-</span>
                                    ) : (
                                        <div className="flex items-center gap-1 ml-1">
                                            <input 
                                                type="number"
                                                min="1"
                                                max={tripDuration}
                                                className="w-10 p-0 text-xs h-5 text-center border-b border-slate-300 bg-transparent focus:border-primary focus:ring-0 focus:outline-none hover:border-slate-400 transition-colors"
                                                value={p.stayDays}
                                                onChange={(e) => handleUpdateParticipantDays(p.id, e.target.value)}
                                            />
                                            <span>dias</span>
                                        </div>
                                    )}
                                </span>
                                
                                {/* Editable Prepaid Amount */}
                                <span className="flex items-center gap-1 text-emerald-600 font-medium ml-1 pl-2 border-l border-slate-300/50">
                                    <Coins className="w-3 h-3"/> 
                                    <span className="mr-0.5">Pagou: R$</span>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        className="w-14 p-0 text-xs h-5 bg-transparent border-b border-emerald-200 focus:border-emerald-500 focus:ring-0 focus:outline-none text-emerald-700 font-bold placeholder-emerald-300"
                                        placeholder="0"
                                        value={p.prepaidAmount || ''}
                                        onChange={(e) => handleUpdateParticipantPrepaid(p.id, e.target.value)}
                                    />
                                </span>

                                {p.isFixed && <span className="text-amber-600 font-bold ml-1 pl-2 border-l border-amber-300/50">Fixo</span>}
                                </span>
                            </div>
                            <button onClick={() => handleDeleteParticipant(p.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-white/80">
                                <X className="w-4 h-4" />
                            </button>
                            </div>
                        ))}
                        </div>
                    </div>
                    </Card>

                    {/* 2. Add Expenses */}
                    <Card title="Lançar Despesa" action={<Receipt className="w-6 h-6 text-slate-400"/>}>
                    <form onSubmit={handleAddExpense} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                            label="Descrição"
                            placeholder="Ex: Aluguel do Sítio" 
                            value={newExpenseName}
                            onChange={(e) => setNewExpenseName(e.target.value)}
                        />
                        <Input 
                            label="Valor Total"
                            type="number" 
                            step="0.01"
                            placeholder="0,00"
                            value={newExpenseAmount}
                            onChange={(e) => setNewExpenseAmount(e.target.value)}
                            prefix="R$"
                            className="font-bold text-lg"
                        />
                        </div>
                        
                        <Select 
                        label="Categoria"
                        value={newExpenseCategory}
                        onChange={(e) => setNewExpenseCategory(e.target.value as ExpenseCategory)}
                        >
                        {Object.values(ExpenseCategory).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                        </Select>

                        {/* Participant Selection */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-end mb-3">
                            <label className="block text-base font-medium text-slate-700">Quem participa desta conta?</label>
                            <button 
                            type="button" 
                            onClick={selectAllParticipants}
                            className="text-sm text-primary font-bold hover:underline"
                            >
                            Selecionar Todos
                            </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {participants.filter(p => !p.isFixed).map(p => {
                            const isSelected = selectedParticipantsForExpense.includes(p.id);
                            return (
                                <div 
                                key={p.id}
                                onClick={() => toggleParticipantSelection(p.id)}
                                className={`cursor-pointer px-4 py-3 rounded-xl border text-base flex items-center justify-between transition-all shadow-sm ${
                                    isSelected 
                                    ? 'bg-primary text-white border-primary font-medium shadow-primary/20' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                }`}
                                >
                                <div className="truncate flex flex-col">
                                    <span>{p.name}</span>
                                    <span className={`text-xs ${isSelected ? 'text-teal-200' : 'text-slate-400'}`}>{p.stayDays} dias</span>
                                </div>
                                {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                                </div>
                            );
                            })}
                            {participants.filter(p => !p.isFixed).length === 0 && (
                            <p className="col-span-3 text-center py-4 text-slate-400 italic">Adicione participantes "padrão" primeiro.</p>
                            )}
                        </div>
                        </div>

                        <Button type="submit" className="w-full" size="lg" disabled={!newExpenseName || !newExpenseAmount || selectedParticipantsForExpense.length === 0}>
                        <Plus className="w-5 h-5 mr-2" /> Adicionar Despesa
                        </Button>
                    </form>
                    </Card>
                </>
                )}

                {activeTab === 'tasks' && (
                <Card title="Atribuir Tarefas" action={<ListTodo className="w-6 h-6 text-slate-400"/>}>
                    <form onSubmit={handleAddTask} className="space-y-5">
                        <Select 
                        label="Tipo de Tarefa"
                        value={newTaskType}
                        onChange={(e) => setNewTaskType(e.target.value as TaskType)}
                        >
                        {Object.values(TaskType).map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                        </Select>
                        
                        <Input 
                        label="Descrição (Opcional)"
                        placeholder="Ex: Preparar o café da manhã"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        />

                        <Select 
                        label="Responsável"
                        value={newTaskParticipantId}
                        onChange={(e) => setNewTaskParticipantId(e.target.value)}
                        >
                        <option value="">Selecione um participante</option>
                        {participants.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                        </Select>

                        <Button type="submit" className="w-full" size="lg" disabled={!newTaskParticipantId}>
                        <Plus className="w-5 h-5 mr-2" /> Atribuir Tarefa
                        </Button>
                    </form>
                </Card>
                )}

                {/* Expense History List (Visible in Expenses Tab) */}
                {activeTab === 'expenses' && expenses.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 px-1 mt-6">Histórico de Despesas</h3>
                    {expenses.map(expense => (
                    <div key={expense.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${CATEGORY_COLORS[expense.category].split(' ')[0]}`}>
                            {React.cloneElement(CATEGORY_ICONS[expense.category] as React.ReactElement, { className: 'w-6 h-6' })}
                        </div>
                        <div>
                            <h4 className="font-bold text-lg text-slate-800">{expense.name}</h4>
                            <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium uppercase tracking-wide ${CATEGORY_COLORS[expense.category]}`}>
                                {expense.category}
                            </span>
                            <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" /> {expense.participantIds.length}
                            </span>
                            </div>
                        </div>
                        </div>
                        <div className="flex items-center gap-6">
                        <span className="font-bold text-lg text-slate-700">{formatCurrency(expense.amount)}</span>
                        <button 
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-2"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                        </div>
                    </div>
                    ))}
                </div>
                )}
                
                {/* Task List (Visible in Tasks Tab) */}
                {activeTab === 'tasks' && tasks.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 px-1 mt-6">Lista de Tarefas</h3>
                    {tasks.map(task => {
                    const person = participants.find(p => p.id === task.participantId);
                    return (
                        <div key={task.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
                                {React.cloneElement(TASK_ICONS[task.type] as React.ReactElement, { className: 'w-6 h-6' })}
                            </div>
                            <div>
                                <h4 className="font-bold text-lg text-slate-800">{task.name}</h4>
                                <p className="text-sm text-slate-500">{task.type}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100">
                                {person?.name || 'Desconhecido'}
                            </span>
                            <button 
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors p-2"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                        </div>
                    );
                    })}
                </div>
                )}
            </div>

            {/* RIGHT COLUMN: Summary (Always Visible, adapts for print) */}
            <div className={`xl:col-span-5 space-y-6 ${activeTab === 'tasks' && 'hidden xl:block'} print:block print:col-span-12 print:w-full ${isGeneratingPdf ? 'col-span-12 w-full block' : ''}`}>
                
                <Card className="bg-slate-900 text-white border-slate-800 print:bg-white print:border-slate-200 print:text-black sticky top-24" title="Resumo Financeiro">
                <div className="space-y-5">
                    {calculationResults.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg">Adicione participantes e despesas para ver o cálculo.</p>
                    </div>
                    ) : (
                    calculationResults.map(result => (
                        <div 
                        key={result.participantId} 
                        className={`relative overflow-hidden rounded-xl p-5 border transition-all shadow-sm ${
                            result.isPaid 
                            ? 'bg-emerald-950 border-emerald-800/50 print:bg-emerald-50 print:border-emerald-200' 
                            : 'bg-slate-950 border-slate-800 print:bg-white print:border-slate-200'
                        }`}
                        >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                            <div className="flex items-center gap-2">
                                <span className={`font-bold text-xl ${result.isPaid ? 'text-emerald-400 print:text-emerald-700' : 'text-white print:text-black'}`}>
                                {result.participantName}
                                </span>
                                {result.isPaid && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                            </div>
                            <div className="flex gap-2 mt-1">
                                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded print:bg-slate-100 print:text-slate-600 border border-slate-700">
                                {result.days} dias
                                </span>
                                {result.isFixed && <span className="text-xs uppercase tracking-wider bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30 print:border-amber-500 print:text-amber-700 print:bg-amber-100">Valor Fixo</span>}
                            </div>
                            </div>
                            <div className="flex items-center gap-4">
                            <div className="text-right">
                                <span className="block text-sm text-slate-400 print:text-slate-500 uppercase font-bold tracking-wider">A Pagar</span>
                                <span className={`block text-3xl font-bold ${
                                    result.isPaid 
                                    ? 'text-emerald-400 print:text-emerald-700' 
                                    : (result.remainingAmount < 0 ? 'text-amber-400' : 'text-white print:text-black')
                                }`}>
                                {formatCurrency(result.isPaid ? 0 : result.remainingAmount)}
                                </span>
                                {result.remainingAmount < 0 && !result.isPaid && (
                                    <span className="text-xs text-amber-400 block">Crédito (Receber)</span>
                                )}
                            </div>
                            
                            {/* Payment Toggle Button (Hidden in Print/PDF) */}
                            <button 
                                onClick={() => togglePaymentStatus(result.participantId)}
                                className={`print:hidden p-2 hover:bg-white/10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 ${isGeneratingPdf ? 'hidden' : 'block'}`}
                                title={result.isPaid ? "Marcar como não pago" : "Marcar como pago"}
                            >
                                {result.isPaid ? (
                                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                ) : (
                                <Circle className="w-8 h-8 text-slate-500 hover:text-white" />
                                )}
                            </button>
                            </div>
                        </div>
                        
                        <div className={`text-sm space-y-2 border-t pt-3 mt-2 ${result.isPaid ? 'border-emerald-500/30 text-emerald-200 print:text-emerald-800' : 'border-slate-800 text-slate-300 print:text-slate-500'}`}>
                            <div className="flex justify-between items-center">
                                <span>Cota da Viagem:</span>
                                <span className="font-semibold">{formatCurrency(result.finalAmount)}</span>
                            </div>
                            {result.discount > 0 && !result.isFixed && (
                            <div className="flex justify-between items-center text-amber-400/80 print:text-amber-700 text-xs">
                                <span>Desconto (convidados):</span>
                                <span>- {formatCurrency(result.discount)}</span>
                            </div>
                            )}
                            {result.prepaidAmount > 0 && (
                                <div className="flex justify-between items-center text-emerald-400 print:text-emerald-700 font-medium bg-emerald-950/30 px-2 py-1 rounded -mx-2">
                                <span>Já pagou (adiantamento):</span>
                                <span>- {formatCurrency(result.prepaidAmount)}</span>
                                </div>
                            )}
                        </div>
                        </div>
                    ))
                    )}
                </div>
                
                {/* Quick Stats */}
                {participants.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-700 print:border-slate-200 grid grid-cols-3 gap-4 text-center">
                        <div>
                        <p className="text-slate-400 print:text-slate-500 text-xs uppercase font-bold tracking-widest">Total</p>
                        <p className="font-bold text-lg text-white print:text-black">{formatCurrency(totalTripCost)}</p>
                        </div>
                        <div>
                        <p className="text-emerald-400/80 print:text-emerald-700 text-xs uppercase font-bold tracking-widest">Pago</p>
                        <p className="font-bold text-lg text-emerald-400 print:text-emerald-700">{formatCurrency(totalPaid)}</p>
                        </div>
                        <div>
                        <p className="text-red-400/80 print:text-red-700 text-xs uppercase font-bold tracking-widest">Pendente</p>
                        <p className="font-bold text-lg text-red-400 print:text-red-700">{formatCurrency(totalTripCost - totalPaid)}</p>
                        </div>
                    </div>
                )}
                </Card>

                {/* Print Only Sections */}
                <div className={`${isGeneratingPdf ? 'block' : 'hidden print:block'} mt-8 break-inside-avoid`}>
                <h2 className="text-2xl font-bold mb-4 border-b-2 border-slate-800 pb-2">Distribuição de Tarefas</h2>
                {tasks.length === 0 ? (
                    <p className="text-slate-500 italic">Nenhuma tarefa atribuída.</p>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                    {tasks.map(task => {
                        const person = participants.find(p => p.id === task.participantId);
                        return (
                        <div key={task.id} className="border border-slate-300 p-4 rounded-lg bg-slate-50 break-inside-avoid">
                            <p className="font-bold text-lg text-slate-900">{task.name}</p>
                            <p className="text-base text-slate-600 mb-2">{task.type}</p>
                            <div className="border-t border-slate-200 pt-2">
                                <p className="text-sm text-slate-500">Responsável:</p>
                                <p className="font-bold text-indigo-700 text-lg">{person?.name}</p>
                            </div>
                        </div>
                        )
                    })}
                    </div>
                )}
                </div>

                <div className={`${isGeneratingPdf ? 'block' : 'hidden print:block'} mt-8`}>
                <h2 className="text-2xl font-bold mb-4 border-b-2 border-slate-800 pb-2">Detalhamento de Despesas</h2>
                <table className="w-full text-base text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                        <th className="p-3">Item</th>
                        <th className="p-3">Categoria</th>
                        <th className="p-3 text-right">Valor</th>
                    </tr>
                    </thead>
                    <tbody>
                    {expenses.map((e, idx) => (
                        <tr key={e.id} className={`border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                        <td className="p-3">{e.name}</td>
                        <td className="p-3">{e.category}</td>
                        <td className="p-3 text-right font-mono font-bold">{formatCurrency(e.amount)}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>

                <div className={`bg-blue-50 border border-blue-100 rounded-xl p-5 text-base text-blue-900 print:hidden shadow-sm ${isGeneratingPdf ? 'hidden' : 'block'}`}>
                <h4 className="font-bold mb-3 flex items-center gap-2 text-lg">
                    <DownloadCloud className="w-5 h-5" /> Compartilhamento em Nuvem
                </h4>
                {cloudId ? (
                    <p className="mb-2 text-blue-800">
                        Você está conectado à nuvem! Todas as alterações salvas aqui serão refletidas para quem tiver o link <strong>?trip={cloudId}</strong>.
                    </p>
                ) : (
                    <p className="mb-2 text-blue-800">
                        Atualmente você está no modo local. Para que seus amigos vejam as atualizações em tempo real, clique em <strong>Conectar Nuvem</strong>.
                    </p>
                )}
                </div>
            </div>

            </div>
        </main>
      </div>
    </div>
  );
}