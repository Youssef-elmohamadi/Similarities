import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, icon, endIcon, id, type, ...props }, ref) => {
    const inputId = id || props.name || Math.random().toString(36).substring(2, 9);
    const isLtrType = type === 'email' || type === 'password' || type === 'url' || type === 'tel';

    return (
      <div className="w-full text-start">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-text-primary mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-text-secondary">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            dir={isLtrType ? 'ltr' : undefined}
            className={cn(
              'w-full h-11 px-3.5 text-sm bg-surface border border-border rounded-lg placeholder:text-text-secondary/60 text-text-primary',
              'text-start transition duration-150',
              'focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary',
              icon && 'ps-10',
              endIcon && 'pe-10',
              error && 'border-danger focus:ring-danger/20 focus:border-danger',
              className
            )}
            {...props}
          />
          {endIcon && (
            <div className="absolute inset-y-0 end-0 flex items-center pe-3 text-text-secondary">
              {endIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="mt-1.5 text-xs text-danger font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-text-secondary">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, rows = 3, ...props }, ref) => {
    const textareaId = id || props.name || Math.random().toString(36).substring(2, 9);

    return (
      <div className="w-full text-start">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-text-primary mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn(
            'w-full p-3.5 text-sm bg-surface border border-border rounded-lg placeholder:text-text-secondary/60 text-text-primary',
            'text-start transition duration-150 resize-y leading-relaxed',
            'focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary',
            error && 'border-danger focus:ring-danger/20 focus:border-danger',
            className
          )}
          {...props}
        />
        {error ? (
          <p className="mt-1.5 text-xs text-danger font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-text-secondary">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: Array<{ value: string | number; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, id, options, children, ...props }, ref) => {
    const selectId = id || props.name || Math.random().toString(36).substring(2, 9);

    return (
      <div className="w-full text-start">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-text-primary mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full h-11 px-3.5 text-sm bg-surface border border-border rounded-lg text-text-primary',
            'text-start transition duration-150',
            'focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary',
            error && 'border-danger focus:ring-danger/20 focus:border-danger',
            className
          )}
          {...props}
        >
          {options
            ? options.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error ? (
          <p className="mt-1.5 text-xs text-danger font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-text-secondary">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
