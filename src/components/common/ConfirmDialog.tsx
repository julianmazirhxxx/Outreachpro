import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  onConfirm,
  onCancel,
  loading = false
}: ConfirmDialogProps) {
  const { theme } = useTheme();

  if (!isOpen) return null;

  const getConfirmButtonStyles = () => {
    switch (type) {
      case 'warning':
        return theme === 'gold'
          ? 'bg-yellow-600 hover:bg-yellow-700 text-black'
          : 'bg-yellow-600 hover:bg-yellow-700 text-white';
      case 'info':
        return theme === 'gold'
          ? 'gold-gradient hover-gold text-black'
          : 'bg-blue-600 hover:bg-blue-700 text-white';
      default:
        return 'bg-red-600 hover:bg-red-700 text-white';
    }
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${
      theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
    }`}>
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className={`w-full max-w-md rounded-xl shadow-2xl ${
          theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
        }`}>
          {/* Header */}
          <div className={`p-6 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  type === 'danger' 
                    ? theme === 'gold' ? 'bg-red-500/20' : 'bg-red-100'
                    : type === 'warning'
                    ? theme === 'gold' ? 'bg-yellow-500/20' : 'bg-yellow-100'
                    : theme === 'gold' ? 'bg-blue-500/20' : 'bg-blue-100'
                }`}>
                  <AlertTriangle className={`h-5 w-5 ${
                    type === 'danger'
                      ? theme === 'gold' ? 'text-red-400' : 'text-red-600'
                      : type === 'warning'
                      ? theme === 'gold' ? 'text-yellow-400' : 'text-yellow-600'
                      : theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                </div>
                <h3 className={`text-lg font-semibold ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  {title}
                </h3>
              </div>
              <button
                onClick={onCancel}
                disabled={loading}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 hover:bg-gray-800'
                    : 'text-gray-500 hover:bg-gray-100'
                } disabled:opacity-50`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className={`text-sm ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className={`p-6 border-t ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
            <div className="flex space-x-3">
              <button
                onClick={onCancel}
                disabled={loading}
                className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                    : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${getConfirmButtonStyles()} disabled:opacity-50`}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Loading...
                  </div>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}