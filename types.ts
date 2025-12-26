export interface Participant {
  id: string;
  name: string;
  isFixed: boolean;
  fixedContribution: number;
  isPaid: boolean;
  stayDays: number;
  prepaidAmount: number; // Valor que a pessoa já adiantou/pagou
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  participantIds: string[];
  manualDistributions?: Record<string, number>; // Novo: { [participantId]: valor }
}

export interface Task {
  id: string;
  name: string;
  type: TaskType;
  participantId: string;
}

export enum TaskType {
  CLEANING = 'Limpeza',
  COOKING = 'Cozinhar',
  DECORATION = 'Decoração',
  DISHES = 'Lavar Louças',
  FOOD_SHOPPING = 'Compras de Comida',
  DRINKS_SHOPPING = 'Compras de Bebidas',
  OTHER = 'Outros'
}

export enum ExpenseCategory {
  ACCOMMODATION = 'Hospedagem',
  FOOD = 'Alimentação',
  DRINKS = 'Bebidas',
  TRANSPORT = 'Transporte',
  FUEL = 'Gasolina',
  DECORATION = 'Decoração',
  OTHER = 'Outros',
}

export interface CalculationResult {
  participantId: string;
  participantName: string;
  rawShare: number;
  discount: number;
  finalAmount: number; // Valor da Cota Total (sem descontar o que já pagou)
  prepaidAmount: number; // Valor adiantado
  remainingAmount: number; // Valor final devido (Cota - Adiantamento)
  isFixed: boolean;
  isPaid: boolean;
  days: number;
}