import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = "", title, action }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-0 print:shadow-none ${className}`}>
    {(title || action) && (
      <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 print:hidden">
        {title && <h3 className="font-bold text-lg text-slate-800">{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6 print:p-0">{children}</div>
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = "", 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed print:hidden";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-teal-800 focus:ring-primary shadow-md shadow-teal-700/10",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500",
    ghost: "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-6 py-3.5 text-lg"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  prefix?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, prefix, className = "", ...props }) => (
  <div className="w-full">
    {label && <label className="block text-base font-medium text-slate-700 mb-2">{label}</label>}
    <div className="relative">
      {prefix && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium select-none pointer-events-none">
          {prefix}
        </div>
      )}
      <input 
        className={`w-full rounded-lg border-slate-300 border py-2.5 text-base text-slate-900 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition shadow-sm placeholder:text-slate-400 ${prefix ? 'pl-10 pr-3' : 'px-3'} ${className}`}
        {...props}
      />
    </div>
    {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
  </div>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select: React.FC<SelectProps> = ({ label, children, className = "", ...props }) => (
  <div className="w-full">
    {label && <label className="block text-base font-medium text-slate-700 mb-2">{label}</label>}
    <div className="relative">
      <select 
        className={`w-full rounded-lg border-slate-300 border px-3 py-2.5 text-base text-slate-900 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition shadow-sm appearance-none ${className}`}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
      </div>
    </div>
  </div>
);