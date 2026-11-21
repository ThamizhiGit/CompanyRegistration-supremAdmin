import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';

/*
 * The form building blocks of the Penquee portal (con-frontend
 * components/ui/generic-form + custom-form-field), rebuilt with Tailwind so
 * the super-admin forms look and behave like the portal's:
 *   FormDialog   - the dialog (title 22px + grey subtitle, scrolling body, actions)
 *   FormSection  - a grey card with an uppercase title
 *   FormField    - uppercase 11.5px label, 1.5px border box, sky focus ring
 *   FormActions  - Cancel (outline) + Save (sky -> cyan gradient)
 *   PageHeader   - the portal's white page title card
 * Inputs inside a FormField take `formControlClass` (borderless; the box draws
 * the border), so input, select and textarea all look the same.
 */

export const formControlClass =
  'w-full border-0 bg-transparent py-[7px] text-[13px] leading-[1.4] text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500';

export const checkboxClass = 'h-4 w-4 cursor-pointer rounded accent-sky-500';

export const FormDialog: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** max width class of the panel, e.g. max-w-2xl */
  widthClass?: string;
  closeLabel?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}> = ({ title, subtitle, onClose, widthClass = 'max-w-3xl', closeLabel = 'Close', footer, children, testId }) => (
  <div
    className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
    data-testid={testId}
    // A click on the dimmed area outside the form closes it, like Cancel.
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`flex max-h-[92vh] w-full ${widthClass} flex-col overflow-hidden rounded-xl bg-white shadow-2xl`}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-6 sm:px-6">
        <div>
          <h3 className="m-0 text-[22px] font-bold tracking-[-0.3px] text-slate-800">{title}</h3>
          {subtitle ? <p className="m-0 mt-1 text-[13px] text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 sm:px-6">{children}</div>
      {footer ? <div className="shrink-0 border-t border-slate-100 px-5 py-3 sm:px-6">{footer}</div> : null}
    </div>
  </div>
);

export const FormSection: React.FC<{
  title: string;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, description, children }) => (
  <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
    <div className="mb-4 flex items-center gap-2.5">
      {icon ? (
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
      ) : null}
      <div>
        <h4 className="m-0 text-[13px] font-bold uppercase tracking-[0.5px] text-slate-800">{title}</h4>
        {description ? <p className="m-0 mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
    </div>
    <div className="flex flex-col gap-4">{children}</div>
  </section>
);

export const FormField: React.FC<{
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  disabled?: boolean;
  /** A checkbox row: no box, the label beside the control. */
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, error, disabled, inline, className = '', children }) => {
  if (inline) {
    return (
      <label className={`flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-slate-700 ${className}`}>
        {children}
        <span>{label}</span>
      </label>
    );
  }
  return (
    <label className={`group block ${className}`}>
      <span
        className={`mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.02em] transition-colors ${
          error ? 'text-red-500' : 'text-slate-500 group-focus-within:text-sky-500'
        }`}
      >
        {label}
        {required ? <span aria-hidden="true" className="ml-px text-red-500">*</span> : null}
      </span>
      <span
        className={`flex min-h-9 items-center rounded-lg border-[1.5px] px-2.5 transition-all ${
          error
            ? 'border-red-500 shadow-[0_0_0_2.5px_rgba(239,68,68,0.06)]'
            : 'border-slate-200 group-focus-within:border-sky-500 group-focus-within:shadow-[0_0_0_2.5px_rgba(14,165,233,0.08)]'
        } ${disabled ? 'cursor-not-allowed bg-slate-50' : 'bg-white'}`}
      >
        {children}
      </span>
      {error ? (
        <span className="mt-1 block text-[11.5px] font-medium text-red-500">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11.5px] text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
};

export const FormActions: React.FC<{
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  disabled?: boolean;
  saveLabel: React.ReactNode;
  savingLabel?: string;
  cancelLabel?: string;
  saveTestId?: string;
}> = ({ onCancel, onSave, saving, disabled, saveLabel, savingLabel = 'Saving...', cancelLabel = 'Cancel', saveTestId }) => (
  <div className="flex items-center justify-end gap-3.5">
    <button
      type="button"
      onClick={onCancel}
      disabled={saving}
      className="h-[42px] rounded-[10px] border-[1.5px] border-slate-300 bg-white px-8 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
    >
      {cancelLabel}
    </button>
    <button
      type="button"
      onClick={onSave}
      disabled={saving || disabled}
      data-testid={saveTestId}
      className="inline-flex h-[42px] items-center gap-2 rounded-[10px] bg-gradient-to-r from-sky-500 to-cyan-400 px-9 text-sm font-bold text-white shadow-[0_2px_8px_rgba(14,165,233,0.25)] transition hover:-translate-y-px hover:from-sky-600 hover:to-cyan-500 hover:shadow-[0_4px_14px_rgba(14,165,233,0.35)] active:scale-[0.98] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-300 disabled:shadow-none"
    >
      {saving ? savingLabel : saveLabel}
    </button>
  </div>
);

/** The portal's page title card (white, bordered, text-2xl). */
export const PageHeader: React.FC<{ title: string; subtitle?: React.ReactNode; children?: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="rounded-md border border-gray-200 bg-white p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="m-0 text-2xl font-semibold text-gray-700">{title}</h2>
        {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  </div>
);

/**
 * The portal's table look (con-frontend components/table) for a plain <table>:
 * sky-600 uppercase headers, 52px rows, sky-50 hover. Add to the table's className.
 */
export const dataTableClass = [
  '[&>thead]:border-b [&>thead]:border-slate-200 [&>thead]:bg-white',
  '[&>thead>tr:first-child>th]:px-3 [&>thead>tr:first-child>th]:py-3.5 [&>thead>tr:first-child>th]:align-top',
  '[&>thead>tr:first-child>th]:text-[14px] [&>thead>tr:first-child>th]:font-extrabold [&>thead>tr:first-child>th]:uppercase',
  '[&>thead>tr:first-child>th]:tracking-wider [&>thead>tr:first-child>th]:text-sky-600 [&>thead>tr:first-child>th]:whitespace-nowrap',
  '[&>tbody>tr]:h-[52px] [&>tbody>tr]:border-t [&>tbody>tr]:border-slate-100 [&>tbody>tr]:transition-colors [&>tbody>tr:hover]:bg-sky-50',
  '[&>tbody>tr>td]:px-3 [&>tbody>tr>td]:py-3 [&>tbody>tr>td]:align-top [&>tbody>tr>td]:text-[14px]',
].join(' ');

/** The white bordered box the portal puts around every table. */
export const dataTableBoxClass = 'relative overflow-x-clip rounded-lg border border-gray-200 bg-white p-2';

/** A sortable column title in the portal's header style. */
export const sortHeaderClass = (active: boolean, align: 'left' | 'right' = 'left') =>
  `inline-flex w-full items-center gap-1 text-[14px] font-extrabold uppercase tracking-wider ${
    align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
  } ${active ? 'text-sky-700' : 'text-sky-600 hover:text-sky-700'}`;

/*
 * In-app confirm / reason dialog, used instead of the browser's
 * window.confirm / window.prompt ("localhost:3001 says ..."):
 *
 *   const { confirm, askReason, dialog } = useConfirmDialog();
 *   if (!(await confirm({ title: 'Switch LKR off?', message: '...', tone: 'danger' }))) return;
 *   const reason = await askReason({ title: 'Delete Premium?', label: 'Reason', defaultValue: '...' });
 *   ...
 *   return <>{page}{dialog}</>;
 *
 * Escape or Cancel answers false / null. A reason is required (OK stays
 * disabled while it is empty), as the audit log needs one.
 */
export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger: red button and icon (delete, switch off, refund). */
  tone?: 'danger' | 'primary';
}

export interface ReasonOptions extends ConfirmOptions {
  label?: string;
  defaultValue?: string;
  placeholder?: string;
}

type DialogState =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'reason'; options: ReasonOptions; resolve: (reason: string | null) => void };

export const ConfirmDialog: React.FC<{
  options: ReasonOptions;
  withReason: boolean;
  onAnswer: (ok: boolean, reason: string) => void;
}> = ({ options, withReason, onAnswer }) => {
  const [reason, setReason] = useState(options.defaultValue ?? '');
  const okRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const danger = options.tone === 'danger';
  const blocked = withReason && !reason.trim();

  useEffect(() => {
    if (withReason) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      okRef.current?.focus();
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onAnswer(false, '');
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4"
      data-testid="confirm-dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onAnswer(false, '');
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={options.message ? 'confirm-dialog-message' : undefined}
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="flex gap-4 px-6 pb-2 pt-6">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              danger ? 'bg-red-50 text-red-600' : 'bg-sky-50 text-sky-600'
            }`}
          >
            {danger ? <AlertTriangle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-dialog-title" className="m-0 text-[17px] font-bold tracking-[-0.2px] text-slate-800">
              {options.title}
            </h3>
            {options.message ? (
              <div id="confirm-dialog-message" data-testid="confirm-dialog-message" className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-slate-500">
                {options.message}
              </div>
            ) : null}
          </div>
        </div>
        {withReason ? (
          <div className="px-6 pt-3">
            <label className="group block">
              <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.02em] text-slate-500 group-focus-within:text-sky-500">
                {options.label || 'Reason'}
                <span aria-hidden="true" className="ml-px text-red-500">*</span>
              </span>
              <textarea
                ref={inputRef}
                data-testid="confirm-dialog-input"
                value={reason}
                rows={2}
                placeholder={options.placeholder}
                onChange={(event) => setReason(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !blocked) {
                    event.preventDefault();
                    onAnswer(true, reason.trim());
                  }
                }}
                className="w-full resize-none rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-[7px] text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:shadow-[0_0_0_2.5px_rgba(14,165,233,0.08)]"
              />
            </label>
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            data-testid="confirm-dialog-cancel"
            onClick={() => onAnswer(false, '')}
            className="h-10 rounded-[10px] border-[1.5px] border-slate-300 bg-white px-6 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800"
          >
            {options.cancelLabel || 'Cancel'}
          </button>
          <button
            ref={okRef}
            type="button"
            data-testid="confirm-dialog-ok"
            disabled={blocked}
            onClick={() => onAnswer(true, reason.trim())}
            className={`h-10 rounded-[10px] px-6 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gradient-to-r from-sky-500 to-cyan-400 shadow-[0_2px_8px_rgba(14,165,233,0.25)] hover:from-sky-600 hover:to-cyan-500'
            }`}
          >
            {options.confirmLabel || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const useConfirmDialog = () => {
  const [state, setState] = useState<DialogState | null>(null);
  const stateRef = useRef<DialogState | null>(null);
  stateRef.current = state;

  // A page left with a question open answers it "no" (nothing waits forever).
  useEffect(() => () => {
    const open = stateRef.current;
    if (open?.kind === 'confirm') open.resolve(false);
    if (open?.kind === 'reason') open.resolve(null);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ kind: 'confirm', options, resolve })),
    [],
  );
  const askReason = useCallback(
    (options: ReasonOptions) => new Promise<string | null>((resolve) => setState({ kind: 'reason', options, resolve })),
    [],
  );

  const dialog = state ? (
    <ConfirmDialog
      key={state.options.title}
      options={state.options}
      withReason={state.kind === 'reason'}
      onAnswer={(ok, reason) => {
        setState(null);
        if (state.kind === 'confirm') state.resolve(ok);
        else state.resolve(ok ? reason : null);
      }}
    />
  ) : null;

  return { confirm, askReason, dialog };
};
