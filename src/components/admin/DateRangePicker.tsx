import React, { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import './DateRangePicker.css';

export interface DateRangeValue {
  from: string;
  to: string;
}

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (range: DateRangeValue) => void;
  onClear: () => void;
  label?: string;
}

type Preset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth';

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1);

const toDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fromDateValue = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
};

const sameDay = (left: Date, right: Date) => toDateValue(left) === toDateValue(right);

const buildCalendarDays = (month: Date): Array<Date | null> => {
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days: Array<Date | null> = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (days.length < 42) days.push(null);
  return days;
};

const formatButtonDate = (value: string) => {
  const date = fromDateValue(value);
  return date
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : value;
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  from,
  to,
  onChange,
  onClear,
  label = 'Select Date Range',
}) => {
  const [open, setOpen] = useState(false);
  const [leftMonth, setLeftMonth] = useState(() => startOfMonth(new Date()));
  const [rightMonth, setRightMonth] = useState(() => addMonths(startOfMonth(new Date()), 1));
  const [selectionStart, setSelectionStart] = useState<Date | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const leftDays = useMemo(() => buildCalendarDays(leftMonth), [leftMonth]);
  const rightDays = useMemo(() => buildCalendarDays(rightMonth), [rightMonth]);
  const hasSelection = Boolean(from || to);

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const popupWidth = Math.min(560, window.innerWidth - 24);
    const popupHeight = 422;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - popupWidth - 12));
    const opensUp = rect.bottom + popupHeight + 8 > window.innerHeight && rect.top > popupHeight;
    setPosition({
      position: 'fixed',
      width: popupWidth,
      left,
      top: opensUp ? undefined : rect.bottom + 8,
      bottom: opensUp ? window.innerHeight - rect.top + 8 : undefined,
      zIndex: 70,
    });
  };

  const openPicker = () => {
    const committedStart = fromDateValue(from);
    const committedEnd = fromDateValue(to);
    const anchor = committedStart || new Date();
    setSelectionStart(committedStart);
    setSelectionEnd(committedEnd);
    setHoveredDate(null);
    setActivePreset(null);
    setLeftMonth(startOfMonth(anchor));
    const endMonth = committedEnd ? startOfMonth(committedEnd) : addMonths(startOfMonth(anchor), 1);
    setRightMonth(endMonth <= startOfMonth(anchor) ? addMonths(startOfMonth(anchor), 1) : endMonth);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const closeOnOutsideClick = (event: MouseEvent) => {
      const node = event.target as Node;
      if (!popupRef.current?.contains(node) && !triggerRef.current?.contains(node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const selectDay = (day: Date) => {
    setActivePreset(null);
    setHoveredDate(null);
    if (!selectionStart || selectionEnd) {
      setSelectionStart(day);
      setSelectionEnd(null);
      return;
    }
    if (day < selectionStart) {
      setSelectionStart(day);
      setSelectionEnd(selectionStart);
    } else {
      setSelectionEnd(day);
    }
  };

  const choosePreset = (preset: Preset) => {
    const today = startOfDay(new Date());
    let rangeStart = new Date(today);
    let rangeEnd = new Date(today);

    if (preset === 'last7') rangeStart.setDate(today.getDate() - 6);
    if (preset === 'last30') rangeStart.setDate(today.getDate() - 29);
    if (preset === 'thisMonth') rangeStart = new Date(today.getFullYear(), today.getMonth(), 1);
    if (preset === 'lastMonth') {
      rangeStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      rangeEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    setActivePreset(preset);
    setSelectionStart(rangeStart);
    setSelectionEnd(rangeEnd);
    setHoveredDate(null);
    setLeftMonth(startOfMonth(rangeStart));
    const presetEndMonth = startOfMonth(rangeEnd);
    setRightMonth(presetEndMonth <= startOfMonth(rangeStart) ? addMonths(startOfMonth(rangeStart), 1) : presetEndMonth);
  };

  const applyRange = () => {
    if (!selectionStart) return;
    const rangeEnd = selectionEnd || selectionStart;
    onChange({ from: toDateValue(selectionStart), to: toDateValue(rangeEnd) });
    setOpen(false);
  };

  const isInRange = (day: Date) => {
    if (!selectionStart) return false;
    const provisionalEnd = selectionEnd || hoveredDate;
    if (!provisionalEnd) return false;
    const rangeStart = selectionStart < provisionalEnd ? selectionStart : provisionalEnd;
    const rangeEnd = selectionStart < provisionalEnd ? provisionalEnd : selectionStart;
    return day > rangeStart && day < rangeEnd;
  };

  const navigateMonth = (side: 'left' | 'right', amount: number) => {
    if (side === 'left') {
      const nextLeft = addMonths(leftMonth, amount);
      setLeftMonth(nextLeft);
      if (nextLeft >= rightMonth) setRightMonth(addMonths(nextLeft, 1));
      return;
    }
    const nextRight = addMonths(rightMonth, amount);
    setRightMonth(nextRight);
    if (nextRight <= leftMonth) setLeftMonth(addMonths(nextRight, -1));
  };

  const renderCalendar = (month: Date, days: Array<Date | null>, side: 'left' | 'right') => (
    <div className={`cdr-calendar ${side}`}>
      <div className="cdr-calendar-header">
        <button
          type="button"
          onClick={() => navigateMonth(side, -1)}
          className="cdr-nav"
          aria-label={`Previous ${side} calendar month`}
        >
          <ChevronLeft size={14} />
        </button>
        <p className="cdr-month-label">
          <span>{month.toLocaleDateString(undefined, { month: 'long' })}</span>
          <span>{month.getFullYear()}</span>
        </p>
        <button
          type="button"
          onClick={() => navigateMonth(side, 1)}
          className="cdr-nav"
          aria-label={`Next ${side} calendar month`}
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="cdr-day-names">
        {DAY_NAMES.map((name) => (
          <span key={name} className="cdr-day-name">
            {name}
          </span>
        ))}
      </div>
      <div className="cdr-day-grid">
        {days.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} className="cdr-day-empty" />;
          const selectedStart = Boolean(selectionStart && sameDay(day, selectionStart));
          const selectedEnd = Boolean(selectionEnd && sameDay(day, selectionEnd));
          const selected = selectedStart || selectedEnd;
          const inRange = isInRange(day);
          const today = sameDay(day, new Date());
          return (
            <button
              key={toDateValue(day)}
              type="button"
              onClick={() => selectDay(day)}
              onMouseEnter={() => !selectionEnd && selectionStart && setHoveredDate(day)}
              className={[
                'cdr-day',
                selected ? 'selected' : '',
                inRange ? 'in-range' : '',
                today ? 'today' : '',
                selectedStart ? 'range-start' : '',
                selectedEnd ? 'range-end' : '',
              ].filter(Boolean).join(' ')}
              aria-label={day.toLocaleDateString()}
              aria-pressed={selected}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="cdr-picker">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={`cdr-trigger ${hasSelection ? 'active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays className="cdr-trigger-icon" />
        <span>{from ? `${formatButtonDate(from)} – ${formatButtonDate(to || from)}` : label}</span>
        <ChevronDown className={`cdr-chevron ${open ? 'open' : ''}`} />
      </button>
      {hasSelection && (
        <button
          type="button"
          onClick={onClear}
          className="cdr-clear"
          title="Clear date range"
          aria-label="Clear date range"
        >
          <X size={14} />
        </button>
      )}

      {open && createPortal(
        <div
          ref={popupRef}
          style={position}
          role="dialog"
          aria-label="Choose date range"
          className="cdr-panel"
        >
          <div className="cdr-presets">
            {([
              ['today', 'Today'],
              ['last7', 'Last 7 Days'],
              ['last30', 'Last 30 Days'],
              ['thisMonth', 'This Month'],
              ['lastMonth', 'Last Month'],
            ] as Array<[Preset, string]>).map(([preset, presetLabel]) => (
              <button
                key={preset}
                type="button"
                onClick={() => choosePreset(preset)}
                className={`cdr-preset ${activePreset === preset ? 'active' : ''}`}
              >
                {presetLabel}
              </button>
            ))}
          </div>

          {selectionStart && (
            <div className="cdr-summary">
              <span className="cdr-summary-item">
                <span className="cdr-summary-dot" />
                From: {selectionStart.toLocaleDateString()}
              </span>
              <span className="cdr-summary-item">
                {selectionEnd && <span className="cdr-summary-dot" />}
                {selectionEnd ? `To: ${selectionEnd.toLocaleDateString()}` : 'Select end date'}
              </span>
            </div>
          )}

          <div className="cdr-calendars">
            {renderCalendar(leftMonth, leftDays, 'left')}
            {renderCalendar(rightMonth, rightDays, 'right')}
          </div>

          <div className="cdr-footer">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cdr-footer-button cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyRange}
              disabled={!selectionStart}
              className="cdr-footer-button apply"
            >
              Set Range
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
