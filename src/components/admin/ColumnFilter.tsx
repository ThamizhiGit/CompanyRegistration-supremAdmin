import React, { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ColumnFilterOption {
  value: string;
  count: number;
}

export const EMPTY_FILTER_VALUE = '(empty)';

export const toColumnFilterValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return EMPTY_FILTER_VALUE;
  return String(value);
};

export const buildColumnFilterOptions = <T,>(
  rows: T[],
  getValue: (row: T) => unknown,
): ColumnFilterOption[] => {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const value = toColumnFilterValue(getValue(row));
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (a.value === EMPTY_FILTER_VALUE) return 1;
      if (b.value === EMPTY_FILTER_VALUE) return -1;
      return a.value.localeCompare(b.value, undefined, { sensitivity: 'base' });
    });
};

export const matchesColumnFilter = (selectedValues: string[], value: unknown): boolean =>
  selectedValues.length === 0 || selectedValues.includes(toColumnFilterValue(value));

interface ColumnFilterProps {
  label: string;
  options: ColumnFilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

export const ColumnFilter: React.FC<ColumnFilterProps> = ({ label, options, selectedValues, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<CSSProperties>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const visibleOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.value.toLowerCase().includes(needle));
  }, [options, query]);

  const toggleValue = (value: string) => {
    const next = new Set(selectedSet);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(Array.from(next));
  };

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const width = 256;
      const maxLeft = window.innerWidth - width - 8;
      const left = Math.max(8, Math.min(rect.left, maxLeft));
      const estimatedHeight = 340;
      const hasRoomBelow = rect.bottom + estimatedHeight < window.innerHeight;
      const top = hasRoomBelow ? rect.bottom + 6 : Math.max(8, rect.top - estimatedHeight - 6);

      setPosition({ position: 'fixed', top, left, width, zIndex: 9999 });
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const popup = open ? (
    <div
      ref={popupRef}
      style={position}
      className="rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
    >
      <div className="px-2 pb-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</div>
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search values..."
        className="mb-2 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
      />
      <div className="max-h-56 overflow-y-auto">
        {visibleOptions.length === 0 ? (
          <div className="px-2 py-3 text-center text-xs text-slate-400">No values</div>
        ) : (
          visibleOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-cyan-50"
            >
              <input
                type="checkbox"
                checked={selectedSet.has(option.value)}
                onChange={() => toggleValue(option.value)}
                className="h-3.5 w-3.5 rounded accent-cyan-500"
              />
              <span className="min-w-0 flex-1 truncate">{option.value}</span>
              <span className="shrink-0 text-[10px] font-semibold text-slate-400">{option.count}</span>
            </label>
          ))
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-700"
        >
          Done
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg border px-2 text-left text-xs font-medium transition ${
          selectedValues.length > 0 || open
            ? 'border-cyan-400 bg-white text-cyan-700 ring-1 ring-cyan-100'
            : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-cyan-300 hover:text-cyan-600'
        }`}
        title={`${label} filter`}
      >
        <span className="truncate">{selectedValues.length > 0 ? `${selectedValues.length} selected` : 'Filter...'}</span>
        <span className="shrink-0 text-[10px]">▾</span>
      </button>
      {popup && createPortal(popup, document.body)}
    </div>
  );
};
