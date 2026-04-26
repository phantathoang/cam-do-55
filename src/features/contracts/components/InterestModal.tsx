import React, { useState } from 'react';
import { Contract } from '../../../lib/db';
import { useAppStore, calculateProfit } from '../../../store';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import DatePicker from '../../../components/ui/DatePicker';

export default function InterestModal({ contract, onClose }: { contract: Contract, onClose: () => void }) {
  const { handlePayInterest, handleCheckout } = useAppStore();
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'interest' | 'checkout' | null>(null);

  const parsedPayDate = new Date(payDate);
  const startDate = parseISO(contract.start_date);
  
  // Set time components to 0 for accurate date comparison
  const d1 = new Date(parsedPayDate.getFullYear(), parsedPayDate.getMonth(), parsedPayDate.getDate());
  const d2 = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const isValidDate = d1 >= d2;

  const currentProfit = isValidDate ? calculateProfit(contract, parsedPayDate) : 0;

  const formatCurrency = (num: number) => {
    return String(Math.floor(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ' ₫';
  };

  const executeAction = async () => {
    if (!isValidDate || !confirmAction) return;
    setLoading(true);
    try {
      if (confirmAction === 'interest') {
        await handlePayInterest(contract, payDate);
        toast.success('Thành công: Đã tái ký hợp đồng mới');
      } else {
        await handleCheckout(contract.id, payDate);
        toast.success('Thành công: Đã kết thúc hợp đồng');
      }
      onClose();
    } catch (err: any) {
      toast.error('Thất bại: ' + (err.message || String(err)));
      setLoading(false);
      setConfirmAction(null);
    }
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-4 animate-in fade-in duration-200"
      onClick={onClose}
      onContextMenu={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT') {
          e.preventDefault();
        }
        e.stopPropagation();
      }}
    >
      <div 
        className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={handleModalClick}
      >
        <div className="bg-slate-800/80 p-4 border-b border-slate-700/50 flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-emerald-400">Bảng Hợp Đồng Vay - Tái Ký</h3>
            <p className="text-xs text-slate-400">Xem và cập nhật ngày đóng lãi mới</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Mã hợp đồng</label>
              <div className="text-sm font-mono text-slate-400 bg-slate-950/50 px-3 py-2 rounded-lg border border-slate-800 truncate">{contract.id}</div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Tên Khách hàng</label>
              <div className="text-sm font-bold text-slate-300 bg-slate-950/50 px-3 py-2 rounded-lg border border-slate-800 truncate">{contract.customer_name}</div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">SĐT</label>
              <div className="text-sm font-mono text-slate-300 bg-slate-950/50 px-3 py-2 rounded-lg border border-slate-800">{contract.customer_phone}</div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Số tiền vay</label>
              <div className="text-sm font-bold text-emerald-400 bg-slate-950/50 px-3 py-2 rounded-lg border border-slate-800">{formatCurrency(contract.amount)}</div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Ngày vay</label>
              <div className="text-sm text-slate-300 bg-slate-950/50 px-3 py-2 rounded-lg border border-slate-800">{format(startDate, 'dd/MM/yyyy')}</div>
            </div>
            
            <div className="space-y-1">
              <label className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                Ngày đóng lãi <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
              </label>
              <DatePicker 
                required
                className={!isValidDate ? '!border-red-500/50 focus-within:!border-red-500' : ''}
                value={payDate}
                onChange={val => setPayDate(val)}
              />
              {!isValidDate && <p className="text-[10px] text-red-400 mt-1">Phải lớn hơn hoặc bằng ngày vay</p>}
            </div>
          </div>

          <div className="mt-2 bg-emerald-950/30 border border-emerald-500/20 rounded-lg p-3 flex justify-between items-center shadow-inner">
            <span className="text-sm text-emerald-100/70 font-medium">Tiền lãi thu kỳ này:</span>
            <span className="text-xl font-bold text-emerald-400 tracking-tight">{isValidDate ? formatCurrency(currentProfit) : '---'}</span>
          </div>

          {confirmAction ? (
            <div className="mt-4 pt-4 border-t border-slate-800 animate-in slide-in-from-bottom-2 fade-in duration-200">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-sm font-semibold text-amber-500 leading-snug">
                  {confirmAction === 'interest' 
                    ? `Xác nhận tái ký lại Hợp đồng đến mốc ngày ${format(parsedPayDate, 'dd/MM/yyyy')}?`
                    : `Xác nhận TẤT TOÁN VÀ KẾT THÚC hợp đồng? Lợi nhuận chốt tại mốc ngày: ${format(parsedPayDate, 'dd/MM/yyyy')}.`}
                </p>
                <div className="flex gap-2 justify-end mt-3">
                  <button 
                    type="button" 
                    onClick={() => setConfirmAction(null)} 
                    disabled={loading}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button 
                    type="button" 
                    onClick={executeAction}
                    disabled={loading}
                    className={`px-5 py-2 rounded-lg text-xs font-bold shadow-[0_0_15px_-3px_var(--tw-shadow-color)] transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed ${
                      confirmAction === 'interest' ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/30' : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/30'
                    }`}
                  >
                    {loading ? 'Đang xử lý...' : 'XÁC NHẬN'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-slate-800">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                Hủy
              </button>
              <button 
                type="button" 
                disabled={!isValidDate}
                onClick={() => setConfirmAction('checkout')}
                className="px-4 py-2.5 bg-amber-500/10 border border-amber-500/50 hover:bg-amber-500/30 text-amber-500 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Kết thúc hợp đồng
              </button>
              <button 
                type="button" 
                disabled={!isValidDate}
                onClick={() => setConfirmAction('interest')}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-sm font-bold shadow-[0_0_15px_-3px_#10b981] transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
              >
                Đóng Lãi (Tái ký)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
