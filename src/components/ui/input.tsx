import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-11 w-full rounded-md border border-border bg-input px-4 text-sm text-input-foreground placeholder:text-caption hover:border-border-soft',
      'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/40 disabled:opacity-60',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'

/** Input com sufixo fixo dentro do campo (ex.: ".eth" do ENS — não é escolha do usuário). */
export const InputWithSuffix = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { suffix: string }>(
  ({ suffix, className, ...props }, ref) => (
    <div className="relative">
      <Input ref={ref} className={cn('pr-14', className)} {...props} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">
        {suffix}
      </span>
    </div>
  ),
)
InputWithSuffix.displayName = 'InputWithSuffix'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-28 w-full rounded-md border border-border bg-input px-4 py-3 text-sm text-input-foreground placeholder:text-caption aria-[invalid=true]:border-danger',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      // fundo e opções com as cores do tema: sem isso o Chrome abre a lista em branco
      'h-11 w-full appearance-none rounded-md border border-border bg-input bg-[length:16px] bg-[position:right_14px_center] bg-no-repeat px-4 pr-10 text-sm text-input-foreground aria-[invalid=true]:border-danger [&_option]:bg-input [&_option]:text-input-foreground',
      // tipo "image:" explícito: senão o tailwind-merge trata a url como cor e descarta o bg-input
      "bg-[image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23cfb28c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
      className,
    )}
    {...props}
  >
    {children}
  </select>
))
NativeSelect.displayName = 'NativeSelect'
