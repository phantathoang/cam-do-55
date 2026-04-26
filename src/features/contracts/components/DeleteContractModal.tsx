import { useState } from 'react';
import { Contract } from '../../../lib/db';
import { useAppStore } from '../../../store';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

export default function DeleteContractModal({ contract, onClose }: { contract: Contract, onClose: () => void }) {
  const { handleDeleteContract } = useAppStore();
  const [loading, setLoading] = useState(false);

  const formatCurrency = (num: number) => {
    return String(Math.floor(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ' ₫';
  };

  const handleConfirmDelete = async () => {
    setLoading(true);
    try {
      await handleDeleteContract(contract.id);
      toast.success('Đã xoá hợp đồng vĩnh viễn!');
      onClose();
    } catch (e) {
      toast.error('Lỗi khi xoá hợp đồng. Có thể dữ liệu liên kết gây kẹt.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-4 border-b border-rose-500/30 flex justify-between items-center bg-rose-500/10">
          <h3 className="text-lg font-bold text-rose-500 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Xác nhận xoá hợp đồng
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <p className="text-slate-300 text-sm">
            Bạn đang chuẩn bị xoá vĩnh viễn hợp đồng này cùng với toàn bộ lịch sử thanh lý (nếu có). Hành động này <strong className="text-rose-400">KHÔNG THỂ HOÀN TÁC</strong>.
          </p>
          
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Mã hợp đồng:</span>
              <span className="font-mono text-slate-300 font-bold">{contract.id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Khách hàng:</span>
              <span className="font-bold text-slate-300">{contract.customer_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Số tiền vay:</span>
              <span className="font-mono font-bold text-amber-400">{formatCurrency(contract.amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Ngày vay:</span>
              <span className="text-slate-300 font-bold">{format(parseISO(contract.start_date), 'dd/MM/yyyy')}</span>
            </div>
          </div>
          
          <div className="pt-2 flex justify-end gap-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-bold transition-colors"
            >
              Hủy, không xoá
            </button>
            <button 
              onClick={handleConfirmDelete}
              disabled={loading}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-lg shadow-rose-500/20"
            >
              <Trash2 className="w-4 h-4" /> {loading ? 'Đang xoá...' : 'Xoá vĩnh viễn'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
