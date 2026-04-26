import React, { useState, useMemo } from 'react';
import { Contract, getLiquidations, updateLiquidation } from '../../../lib/db';
import { useAppStore } from '../../../store';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Coins, X } from 'lucide-react';
import DatePicker from '../../../components/ui/DatePicker';

export default function LiquidationActionModal({ contract, onClose, onSuccess }: { contract: Contract, onClose: () => void, onSuccess: () => void }) {
  const { handleLiquidate } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [isPendingOnly, setIsPendingOnly] = useState(true);
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Parse assets
  const assets = useMemo(() => {
    try {
      const parsed = JSON.parse(contract.asset || '');
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch(e) {}
    return [{ type: 'Tài sản', description: contract.asset || 'Không rõ' }];
  }, [contract.asset]);

  const [prices, setPrices] = useState<string[]>(assets.map(() => ''));

  const handlePriceChange = (index: number, val: string) => {
    const raw = val.replace(/\D/g, '');
    const newPrices = [...prices];
    newPrices[index] = raw ? Number(raw).toLocaleString('vi-VN') : '';
    setPrices(newPrices);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await handleLiquidate(contract); // this sets status to Thanh Lý and creates liquidation record
      
      if (!isPendingOnly) {
        let total = 0;
        prices.forEach(p => {
          const raw = Number(p.replace(/\D/g, ''));
          if (raw) total += raw;
        });

        const dbLiqs = await getLiquidations();
        const latest = dbLiqs.find(l => l.contract_id === contract.id);
        if (latest) {
          await updateLiquidation(latest.id, total, dateStr);
        }
      }
      
      toast.success('Đã lưu hồ sơ thanh lý thành công!');
      onSuccess();
    } catch (e: any) {
      toast.error('Lỗi: ' + (e.message || String(e)));
      setLoading(false);
    }
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
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-amber-900/40 p-4 border-b border-amber-500/30 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Coins className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-400">Thanh Lý / Thu Hồi Tài Sản</h3>
              <p className="text-xs text-slate-400">Hợp đồng: <span className="text-slate-300 font-mono">{contract.customer_name}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 flex flex-col gap-5">
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 font-mono text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-slate-400">Tổng tiền vay (Vốn):</span>
              <span className="text-blue-400 font-bold">{contract.amount.toLocaleString('vi-VN')} đ</span>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition">
            <input 
              type="checkbox" 
              checked={isPendingOnly} 
              onChange={e => setIsPendingOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 text-amber-500 focus:ring-amber-500 bg-slate-900"
            />
            <span className="text-sm font-semibold text-slate-300">Chỉ đưa vào kho chờ thanh lý (Chưa có giá bán)</span>
          </label>

          {!isPendingOnly && (
            <div className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
              <div className="text-xs uppercase font-bold text-slate-500 tracking-wider">Nhập Giá Thanh Lý Từng Tài Sản</div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                {assets.map((a, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
                    <span className="text-xs font-bold text-slate-300 truncate">{a.type} - {a.description}</span>
                    <div className="relative">
                      <input 
                        type="text" 
                        required
                        value={prices[i]}
                        onChange={e => handlePriceChange(i, e.target.value)}
                        placeholder="Nhập giá bán"
                        className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-emerald-400 font-bold outline-none focus:border-amber-500 transition-colors"
                      />
                      <span className="absolute right-3 top-2 text-slate-500 text-sm font-bold">đ</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-2">
                <div className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">Ngày Bán / Chốt Thanh Lý</div>
                <DatePicker 
                  required
                  value={dateStr}
                  onChange={val => setDateStr(val)}
                  className="!bg-slate-900 !border-slate-600 focus-within:!border-amber-500"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition"
            >
              Hủy bỏ
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition shadow-[0_0_15px_-3px_rgba(245,158,11,0.5)] disabled:opacity-50"
            >
              {loading ? 'Đang xử lý...' : isPendingOnly ? 'Đưa vào kho' : 'Chốt Thanh Lý'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
