import React from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, description }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-8 sm:p-12 text-center max-w-2xl mx-auto my-8">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
        <Construction size={32} />
      </div>
      <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">{title}</h2>
      <p className="text-sm text-slate-500 mt-2">
        {description || 'Módulo listo para ser implementado en las siguientes tareas de la migración React.'}
      </p>
      <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-xs font-semibold text-slate-600">
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        <span>Ruta activa en React Router v7</span>
      </div>
    </div>
  );
};

export default PlaceholderPage;

