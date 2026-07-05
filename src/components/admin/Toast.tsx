import React, { useEffect } from 'react';
import { Check, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ type, message, onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgColor = type === 'success' ? 'border-green-300' :
                  type === 'error' ? 'border-red-300' :
                  'border-cyan-300';

  const bgStyle = type === 'success' ? {backgroundColor: '#e1f5e1'} :
                  type === 'error' ? {backgroundColor: '#ffe1e1'} :
                  {backgroundColor: '#e0f7fa'};

  const textColor = type === 'success' ? '#2d6a4f' :
                    type === 'error' ? '#b91c1c' :
                    '#00838f';

  const Icon = type === 'success' ? Check : type === 'error' ? AlertCircle : Check;
  const iconColor = type === 'success' ? '#27ae60' :
                    type === 'error' ? '#dc2626' :
                    '#0288d1';

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center gap-3 border animate-in slide-in-from-right-2 fade-in duration-300`} style={{...bgStyle, borderColor: bgColor, color: textColor}}>
      <Icon className="w-5 h-5 shrink-0" style={{color: iconColor}} />
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-gray-400 hover:text-gray-600 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};