import React, { useState } from 'react';
import { Contract } from '../../../lib/db';
import { useAppStore, calculateProfit } from '../../../store';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, ShieldAlert, Coins } from 'lucide-react';
import DatePicker from '../../../components/ui/DatePicker';

export default function InlineLiquidationForm({ contract }: { contract: Contract }) {
  const { liquidations, handleUpdateLiquidation } = useAppStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [priceStr, setPriceStr] = useState('');
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));

  const liq = liquidations.find(l => l.contract_id === contract.id);
  if (!liq) {
    return <div className="text-xs text-slate-500 italic px-4 py-2">Đang tải dữ liệu thanh lý...</div>;
  }

  const handleFormatPrice = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (!raw) { setPriceStr(''); return; }
    setPriceStr(Number(raw).toLocaleString('vi-VN'));
  };

  const submitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawPrice = Number(priceStr.replace(/\D/g, ''));
    if (!rawPrice || !dateStr) return;
    await handleUpdateLiquidation(liq.id, rawPrice, dateStr);
    setIsUpdating(false);
  };

  const loanAmount = liq.loan_amount;
  const isDone = liq.status === 'Đã thanh lý';
  
  let interestOwed = 0;
  let profit = 0;
  
  if (isDone) {
    interestOwed = calculateProfit(contract, parseISO(liq.liquidation_date || new Date().toISOString()));
    profit = liq.liquidation_price! - loanAmount - interestOwed;
  } else {
    interestOwed = calculateProfit(contract, new Date());
  }

  return (
    <div className="w-full bg-slate-800/80 rounded-xl border border-amber-500/30 overflow-hidden">
      <div className="p-3 bg-slate-900/50 border-b border-amber-500/20 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 text-orange-400" />}
          <span className="font-bold text-sm text-slate-200">Trạng thái TS: </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
            {liq.status}
          </span>
        </div>
      </div>
      
      <div className="p-4 flex flex-col md:flex-row gap-6">
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Giá cầm (Vốn)</div>
            <div className="font-mono font-bold text-blue-400">{loanAmount.toLocaleString('vi-VN')} đ</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Tiền lãi ước tính</div>
            <div className="font-mono font-bold text-amber-400">{Math.round(interestOwed).toLocaleString('vi-VN')} đ</div>
          </div>
          <div className="col-span-2 md:col-span-1 border-l border-slate-700 pl-4">
            <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Tổng Vay + Lãi</div>
            <div className="font-mono font-bold text-slate-200 text-base">{Math.round(loanAmount + interestOwed).toLocaleString('vi-VN')} đ</div>
          </div>
        </div>

        <div className="flex-1 border-t md:border-t-0 md:border-l border-slate-700/50 pt-4 md:pt-0 md:pl-6">
          {isDone ? (
            <div className="flex flex-col h-full justify-center">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-xs">Giá bán ({format(parseISO(liq.liquidation_date || ''), 'dd/MM/yyyy')}):</span>
                <span className="font-mono font-bold text-lg text-emerald-400">{liq.liquidation_price?.toLocaleString('vi-VN')} ₫</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                <span className="text-slate-400 text-xs font-semibold">Kết quả tài chính:</span>
                {profit >= 0 ? (
                  <div className="font-bold text-emerald-400">LỜI +{Math.round(profit).toLocaleString('vi-VN')} đ</div>
                ) : (
                  <div className="font-bold text-red-400">LỖ {Math.round(profit).toLocaleString('vi-VN')} đ</div>
                )}
              </div>
            </div>
          ) : (
            isUpdating ? (
              <form onSubmit={submitUpdate} className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input required type="text" value={priceStr} onChange={handleFormatPrice} className="w-full bg-slate-950 border border-amber-500/50 rounded px-2 py-1.5 text-sm text-emerald-400 font-bold outline-none" placeholder="Nhập giá bán" />
                  </div>
                  <div className="w-36">
                    <DatePicker required value={dateStr} onChange={val => setDateStr(val)} className="!py-0" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-1">
                  <button type="button" onClick={() => setIsUpdating(false)} className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded font-semibold transition">Hủy</button>
                  <button type="submit" className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded shadow-md transition">Chốt Bán</button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-end h-full">
                <button 
                  onClick={() => setIsUpdating(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-lg shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)] transition-all transform hover:scale-105"
                >
                  <Coins className="w-4 h-4" /> Điền Giá Bán Tài Sản
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
