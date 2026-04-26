import { useRef } from 'react';
import { Calendar } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  required?: boolean;
  min?: string;
  max?: string;
}

export default function DatePicker({ value, onChange, className = '', required = false, min, max }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    // try to show native picker programmatically
    try {
      if (inputRef.current && 'showPicker' in HTMLInputElement.prototype) {
        inputRef.current.showPicker();
      }
    } catch(e) {}
  };

  return (
    <div 
      className={`relative w-full flex items-center bg-slate-950/70 border border-slate-700/80 hover:border-emerald-500/50 rounded-lg transition-colors cursor-pointer focus-within:border-emerald-500 ${className}`}
      onClick={handleClick}
    >
      <div className="absolute left-3 pointer-events-none text-emerald-500">
        <Calendar className="w-4 h-4" />
      </div>
      <input 
        ref={inputRef}
        type="date"
        required={required}
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent pl-9 pr-3 py-2 text-sm text-slate-200 outline-none [color-scheme:dark] block z-10 date-input-clean"
      />
    </div>
  );
}
