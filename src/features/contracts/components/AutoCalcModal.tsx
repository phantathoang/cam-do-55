import { useState } from 'react';
import { Contract } from '../../../lib/db';
import { useAppStore, calculateProfit } from '../../../store';
import { toast } from 'sonner';
import { Calculator, X, Bot, Sparkles } from 'lucide-react';

export default function AutoCalcModal({ contract, onClose }: { contract: Contract, onClose: () => void }) {
  const { handleAutoCalcAction } = useAppStore();
  const [amountPaidStr, setAmountPaidStr] = useState('');
  const [loading, setLoading] = useState(false);
  const expectedInterest = calculateProfit(contract, new Date());
  
  const formatCurrency = (num: number) => String(Math.floor(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const amountPaid = amountPaidStr ? Number(amountPaidStr.replace(/\D/g, '')) : 0;
  const diff = amountPaid - expectedInterest;

  const handleAction = async (newAmount: number, type: 'match' | 'decrease_principal' | 'increase_principal' | 'debt') => {
    setLoading(true);
    try {
      await handleAutoCalcAction(contract, newAmount, type, diff);
      onClose();
    } catch (e) {
      toast.error('Lỗi khi thực hiện nghiệp vụ');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-500" /> Trợ Lý Tính Toán (AI)
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tiền lãi dự kiến:</span>
              <span className="font-mono text-amber-400 font-bold">{formatCurrency(expectedInterest)} ₫</span>
            </div>
            <div className="flex justify-between text-sm items-center mt-2 border-t border-slate-800 pt-3">
              <span className="text-slate-400 font-bold">Khách đưa:</span>
              <div className="relative w-40">
                <input 
                  type="text" 
                  autoFocus
                  placeholder={formatCurrency(expectedInterest)}
                  value={amountPaidStr}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setAmountPaidStr(raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : '');
                  }}
                  className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1.5 text-right text-emerald-400 font-bold outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 relative overflow-hidden">
            <Bot className="absolute -right-2 -bottom-2 w-16 h-16 text-emerald-500/10" />
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Gợi ý xử lý:
            </h4>
            
            {!amountPaidStr ? (
              <p className="text-sm text-slate-400 leading-relaxed">
                Vui lòng nhập số tiền khách thực đưa để hệ thống tính toán phương án tối ưu nhất.
              </p>
            ) : diff === 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-emerald-300 font-bold">✓ Khách đóng vừa đủ tiền lãi.</p>
                  <p className="text-xs text-slate-400">Tự động tất toán lãi hiện tại và khởi tạo Hợp đồng Tái ký với Nợ gốc giữ nguyên: <strong className="text-amber-400">{formatCurrency(contract.amount)} ₫</strong>.</p>
                </div>
                <button
                  disabled={loading}
                  onClick={() => handleAction(contract.amount, 'match')}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-sm transition disabled:opacity-50"
                >
                  {loading ? 'Đang xử lý...' : 'Thực hiện Tái ký giữ nguyên gốc'}
                </button>
              </div>
            ) : diff > 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-blue-400 font-bold">↑ Khách đóng dư {formatCurrency(diff)} ₫.</p>
                  <p className="text-xs text-slate-400">Bạn có thể chọn bớt dư nợ gốc. Hợp đồng Tái ký mới sẽ có Nợ gốc giảm xuống còn: <strong className="text-amber-400">{formatCurrency(contract.amount - diff)} ₫</strong>.</p>
                </div>
                <button
                  disabled={loading}
                  onClick={() => handleAction(contract.amount - diff, 'decrease_principal')}
                  className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-slate-950 font-bold rounded-lg text-sm transition disabled:opacity-50"
                >
                  {loading ? 'Đang xử lý...' : 'Thực hiện Bớt Gốc & Tái Ký'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-rose-400 font-bold">↓ Khách đóng thiếu {formatCurrency(Math.abs(diff))} ₫.</p>
                  <p className="text-xs text-slate-400">Hệ thống đề xuất 2 phương án:</p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={loading}
                    onClick={() => handleAction(contract.amount + Math.abs(diff), 'increase_principal')}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 border border-amber-500/50 text-amber-400 font-bold rounded-lg text-xs transition disabled:opacity-50"
                  >
                    A. Lãi nhập gốc ({formatCurrency(contract.amount + Math.abs(diff))} ₫)
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => handleAction(contract.amount, 'debt')}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 border border-rose-500/50 text-rose-400 font-bold rounded-lg text-xs transition disabled:opacity-50"
                  >
                    B. Ghi Nợ Tồn ({formatCurrency(contract.amount)} ₫)
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-bold transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
