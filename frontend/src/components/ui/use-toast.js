import { toast as sonnerToast } from 'sonner';

export function useToast() {
  const toast = ({ title, description, variant = 'default', className = '' }) => {
    const toastOptions = {
      description,
      className: `${className} ${variant === 'destructive' ? 'bg-red-100 border-red-400 text-red-700' : 'bg-white border-gray-200'}`,
    };

    if (variant === 'destructive') {
      sonnerToast.error(title, toastOptions);
    } else {
      sonnerToast.success(title, toastOptions);
    }
  };

  return { toast };
}