import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) => {
  let buttonStyle = 'bg-rose-600 hover:bg-rose-700 text-white';
  let iconStyle = 'bg-rose-100 text-rose-600';

  if (variant === 'warning') {
    buttonStyle = 'bg-amber-500 hover:bg-amber-600 text-white';
    iconStyle = 'bg-amber-100 text-amber-700';
  } else if (variant === 'primary') {
    buttonStyle = 'bg-periwinkle hover:bg-periwinkle-600 text-white';
    iconStyle = 'bg-periwinkle-100 text-periwinkle-800';
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${iconStyle}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-sm text-charcoal-600 leading-relaxed">{description}</p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-ivory-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 ${buttonStyle}`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
