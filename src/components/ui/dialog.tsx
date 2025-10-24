import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface DialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface DialogTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
}

interface DialogHeaderProps {
  className?: string;
  children: React.ReactNode;
}

interface DialogTitleProps {
  className?: string;
  children: React.ReactNode;
}

const DialogContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({ isOpen: false, setIsOpen: () => {} });

export const Dialog: React.FC<DialogProps> = ({ children, open, onOpenChange }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;
  
  return (
    <DialogContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </DialogContext.Provider>
  );
};

export const DialogTrigger: React.FC<DialogTriggerProps> = ({ children }) => {
  const { setIsOpen } = React.useContext(DialogContext);
  
  return (
    <div onClick={() => setIsOpen(true)}>
      {children}
    </div>
  );
};

export const DialogContent: React.FC<DialogContentProps> = ({ className, children }) => {
  const { isOpen, setIsOpen } = React.useContext(DialogContext);
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, setIsOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Content */}
      <div
        className={cn(
          'relative z-50 grid w-full max-w-lg gap-4 border bg-white text-gray-900 p-6 shadow-lg duration-200 sm:rounded-lg',
          className
        )}
      >
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onClick={() => setIsOpen(false)}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
};

export const DialogHeader: React.FC<DialogHeaderProps> = ({ className, children }) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}>
    {children}
  </div>
);

export const DialogTitle: React.FC<DialogTitleProps> = ({ className, children }) => (
  <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>
    {children}
  </h2>
);