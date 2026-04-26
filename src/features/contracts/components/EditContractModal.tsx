import React, { useState } from 'react';
import { Contract } from '../../../lib/db';
import { useAppStore } from '../../../store';
import { toast } from 'sonner';
import { Edit, X, Save } from 'lucide-react';
import DatePicker from '../../../components/ui/DatePicker';

export default function EditContractModal({ contract, onClose }: { contract: Contract, onClose: () => void }) {
  const { handleUpdateContract } = useAppStore();
  
  const oldAmountFormatted = contract.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const [formData, setFormData] = useState({
    amount: '',
    interest_rate: contract.interest_rate.toString(),
    start_date: contract.start_date,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await handleUpdateContract(contract.id, {
        amount: formData.amount ? Number(formData.amount.replace(/\./g, '')) : contract.amount,
        interest_rate: formData.interest_rate ? Number(formData.interest_rate.replace(/\./g, '')) : contract.interest_rate,
        start_date: formData.start_date
      });
      toast.success('Đã cập nhật hợp đồng thành công!');
      onClose();
    } catch (err) {
      toast.error('Lỗi khi cập nhật hợp đồng');
    }
  };

  const handleInput = (field: 'amount' | 'interest_rate', val: string) => {
    const cleanVal = val.replace(/\D/g, '');
    const formatted = cleanVal ? cleanVal.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : '';
    setFormData(prev => ({ ...prev, [field]: formatted }));
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Edit className="w-5 h-5 text-amber-500" /> Sửa thông tin hợp đồng
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-4 pb-1 space-y-1">
          <div className="flex justify-between text-sm bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
            <span className="text-slate-500">Hợp đồng:</span>
            <span className="font-mono text-amber-400/90 font-bold">{contract.id}</span>
          </div>
          <div className="flex justify-between text-sm bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
            <span className="text-slate-500">Khách hàng:</span>
            <span className="font-bold text-slate-300">{contract.customer_name}</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4 pt-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-medium">Số tiền vay (VNĐ)</label>
            <input 
              type="text" 
              placeholder={oldAmountFormatted}
              value={formData.amount}
              onChange={e => handleInput('amount', e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none transition-colors font-mono placeholder:text-slate-600"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-medium">Lãi suất (VNĐ/Triệu/Ngày)</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={formData.interest_rate}
                onChange={e => {
                  let val = e.target.value.replace(/\D/g, '');
                  if (val && Number(val) > 2500) val = '2500';
                  handleInput('interest_rate', val);
                }}
                className="w-1/3 bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none transition-colors font-mono"
              />
              <div className="flex-1 flex bg-slate-950/50 border border-slate-700/80 p-0.5 rounded-lg h-[38px]">
                {['1000', '1500', '2000', '2500'].map(rate => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setFormData({...formData, interest_rate: rate})}
                    className={`flex-1 flex items-center justify-center text-[11px] font-bold rounded-md transition-all duration-200 ${
                      formData.interest_rate === rate 
                      ? 'bg-amber-500 text-slate-950 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {rate.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-medium">Ngày bắt đầu</label>
            <DatePicker 
              value={formData.start_date}
              onChange={val => setFormData({...formData, start_date: val})}
            />
          </div>
          
          <div className="pt-4 flex justify-end gap-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-bold transition-colors"
            >
              Hủy
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <Save className="w-4 h-4" /> Lưu Thay Đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
