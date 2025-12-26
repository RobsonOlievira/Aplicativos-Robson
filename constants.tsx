import React from 'react';
import { 
  Home, 
  Utensils, 
  Beer, 
  Bus, 
  Fuel, 
  PartyPopper, 
  HelpCircle,
  SprayCan,
  ChefHat,
  ShoppingCart,
  GlassWater
} from 'lucide-react';
import { ExpenseCategory, TaskType } from './types';

export const CATEGORY_ICONS: Record<ExpenseCategory, React.ReactNode> = {
  [ExpenseCategory.ACCOMMODATION]: <Home className="w-5 h-5" />,
  [ExpenseCategory.FOOD]: <Utensils className="w-5 h-5" />,
  [ExpenseCategory.DRINKS]: <Beer className="w-5 h-5" />,
  [ExpenseCategory.TRANSPORT]: <Bus className="w-5 h-5" />,
  [ExpenseCategory.FUEL]: <Fuel className="w-5 h-5" />,
  [ExpenseCategory.DECORATION]: <PartyPopper className="w-5 h-5" />,
  [ExpenseCategory.OTHER]: <HelpCircle className="w-5 h-5" />,
};

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.ACCOMMODATION]: 'bg-blue-100 text-blue-700 border-blue-200',
  [ExpenseCategory.FOOD]: 'bg-orange-100 text-orange-700 border-orange-200',
  [ExpenseCategory.DRINKS]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  [ExpenseCategory.TRANSPORT]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  [ExpenseCategory.FUEL]: 'bg-red-100 text-red-700 border-red-200',
  [ExpenseCategory.DECORATION]: 'bg-pink-100 text-pink-700 border-pink-200',
  [ExpenseCategory.OTHER]: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const TASK_ICONS: Record<TaskType, React.ReactNode> = {
  [TaskType.CLEANING]: <SprayCan className="w-5 h-5" />,
  [TaskType.COOKING]: <ChefHat className="w-5 h-5" />,
  [TaskType.DECORATION]: <PartyPopper className="w-5 h-5" />,
  [TaskType.DISHES]: <GlassWater className="w-5 h-5" />,
  [TaskType.FOOD_SHOPPING]: <ShoppingCart className="w-5 h-5" />,
  [TaskType.DRINKS_SHOPPING]: <Beer className="w-5 h-5" />,
  [TaskType.OTHER]: <HelpCircle className="w-5 h-5" />,
};