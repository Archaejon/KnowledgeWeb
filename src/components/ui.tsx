import { cloneElement, isValidElement, useEffect, useId, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import type { Scope } from '../core/types';
import { scopeLabel } from '../core/access';

// -------------------------------------------------------------- button

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'quiet' | 'ghost' | 'danger' | 'link';
  size?: 'sm' | 'md';
  icon?: IconName;
  block?: boolean;
}

export function Button({
  variant = 'quiet',
  size = 'md',
  icon,
  block,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size}${block ? ' btn-block' : ''} ${className}`.trim()}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      {children}
    </button>
  );
}

// -------------------------------------------------------------- badge

export function Badge({
  children,
  tone = 'neutral',
  dot,
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'sample' | 'info';
  dot?: boolean;
  title?: string;
}) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {dot ? <span className="badge-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function ScopeBadge({ scope, short }: { scope: Scope; short?: boolean }) {
  const icon: IconName =
    scope === 'private'
      ? 'lock'
      : scope === 'relationship'
        ? 'key'
        : scope === 'community'
          ? 'community'
          : 'eye';
  return (
    <span className={`badge scope-badge scope-${scope}`} title={scopeLabel(scope)}>
      <Icon name={icon} size={13} />
      {/* The short variant is icon-only, so the label has to stay in the
          accessibility tree even when it is not visible. */}
      {short ? <span className="sr-only">{scopeLabel(scope)}</span> : scopeLabel(scope)}
    </span>
  );
}

// -------------------------------------------------------------- card & layout helpers

export function Card({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article' | 'aside';
}) {
  return <Tag className={`card ${className}`.trim()}>{children}</Tag>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="card-head">
      <div className="card-head-main">
        {icon ? (
          <span className="card-icon">
            <Icon name={icon} size={18} />
          </span>
        ) : null}
        <div>
          <h2 className="card-title">{title}</h2>
          {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="card-head-action">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
        {children}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({
  icon = 'leaf',
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      {children ? <div className="empty-body">{children}</div> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {initials}
    </span>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-wrap">
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <span style={{ width: `${clamped}%` }} />
      </div>
      <span className="progress-label">{clamped}%</span>
    </div>
  );
}

// -------------------------------------------------------------- form fields

export function Field({
  label,
  children,
  hint,
  error,
  htmlFor,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  required?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // Hints and errors must be programmatically tied to the control, not just
  // placed underneath it. Only plain DOM children are cloned.
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  const control =
    isValidElement(children) && typeof children.type === 'string'
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          'aria-describedby': describedBy || undefined,
          'aria-invalid': error ? true : undefined,
        })
      : children;

  return (
    <div className={`field${error ? ' field-invalid' : ''}`}>
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span className="req" aria-hidden="true"> *</span> : null}
      </label>
      {control}
      {hint ? (
        <div className="field-hint" id={hintId}>
          {hint}
        </div>
      ) : null}
      {error ? (
        <div className="field-error" id={errorId} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div className="form-error" role="alert">
      <Icon name="alert" size={16} />
      <span>{children}</span>
    </div>
  );
}

export function Notice({
  tone = 'info',
  title,
  children,
  icon,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'success' | 'quiet';
  title?: string;
  children: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className={`notice notice-${tone}`}>
      <Icon
        name={icon ?? (tone === 'warn' || tone === 'danger' ? 'alert' : tone === 'success' ? 'check' : 'info')}
        size={18}
      />
      <div>
        {title ? <strong>{title}</strong> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- modal

// Open dialogs are portalled to <body>, so the app itself can be made inert
// while one is open. Counters keep stacked dialogs correct: the app only
// becomes interactive again when the last one closes.
const modalStack: HTMLElement[] = [];
let appInertCount = 0;
let bodyScrollLocks = 0;
let bodyOverflowBeforeLock = '';

function lockAppInert() {
  if (appInertCount === 0) document.getElementById('root')?.setAttribute('inert', '');
  appInertCount += 1;
}

function unlockAppInert() {
  appInertCount = Math.max(0, appInertCount - 1);
  if (appInertCount === 0) document.getElementById('root')?.removeAttribute('inert');
}

function lockBodyScroll() {
  if (bodyScrollLocks === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyScrollLocks += 1;
}

function unlockBodyScroll() {
  bodyScrollLocks = Math.max(0, bodyScrollLocks - 1);
  if (bodyScrollLocks === 0) document.body.style.overflow = bodyOverflowBeforeLock;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Callers usually pass an inline arrow function. Keeping the latest handler
  // in a ref avoids tearing the dialog down (and re-stealing focus) whenever
  // the parent re-renders while it is open.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    lockBodyScroll();
    lockAppInert();
    const node = dialogRef.current;
    if (node) modalStack.push(node);
    const focusable = node?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])',
    );
    const focusTimer = window.setTimeout(() => focusable?.focus(), 30);

    const onKeyDown = (event: KeyboardEvent) => {
      // A dialog opened on top of another one owns the keyboard.
      if (modalStack[modalStack.length - 1] !== node) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const items = Array.from(
        node.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown, true);
      const index = node ? modalStack.indexOf(node) : -1;
      if (index !== -1) modalStack.splice(index, 1);
      unlockBodyScroll();
      unlockAppInert();
      // The trigger may have been removed while the dialog was open (a row
      // that was deleted, for example). Fall back to the page body.
      const trigger = previouslyFocused.current;
      if (trigger?.isConnected) trigger.focus();
      else document.getElementById('main')?.focus();
    };
  }, [open]);

  if (!open) return null;

  // Portalled to <body> so the dialog is not itself inside the inert app.
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        ref={dialogRef}
      >
        <div className="modal-head">
          <div>
            <h2 id={`${id}-title`}>{title}</h2>
            {description ? (
              <p id={`${id}-desc`} className="modal-desc">
                {description}
              </p>
            ) : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  tone = 'primary',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="confirm-body">{children}</div>
    </Modal>
  );
}

// -------------------------------------------------------------- misc

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  // These buttons filter a single view rather than swapping tab panels, so they
  // are a labelled group of pressed toggles, not an ARIA tablist.
  return (
    <div className="tabs" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={`tab${value === option.value ? ' is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined ? <span className="tab-count">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function InlineMeta({ items }: { items: (ReactNode | null | false)[] }) {
  const visible = items.filter(Boolean);
  return (
    <div className="inline-meta">
      {visible.map((item, index) => (
        <span className="inline-meta-item" key={index}>
          {index > 0 ? <span className="meta-sep" aria-hidden="true">·</span> : null}
          {item}
        </span>
      ))}
    </div>
  );
}

export function DownloadButton({
  filename,
  content,
  mime = 'text/plain',
  children,
  variant = 'quiet',
  icon = 'download',
}: {
  filename: string;
  content: string;
  mime?: string;
  children: ReactNode;
  variant?: ButtonProps['variant'];
  icon?: IconName;
}) {
  const download = () => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant={variant} icon={icon} onClick={download}>
      {children}
    </Button>
  );
}
