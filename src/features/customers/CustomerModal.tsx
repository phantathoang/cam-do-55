import { useState } from 'react';
import { useAppStore } from '../../store';
import { X, Users, Phone, Edit2 } from 'lucide-react';
import DatePicker from '../../components/ui/DatePicker';

export default function CustomerModal({ onClose }: { onClose: () => void }) {
  const { customers } = useAppStore();
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-800/80 p-4 border-b border-slate-700/50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
              <Users className="w-5 h-5" /> 
              Danh Sách Khách Hàng
            </h3>
            <p className="text-xs text-slate-400">Quản lý toàn bộ thông tin cá nhân của khách hàng</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          {customers.length === 0 ? (
            <div className="text-center py-10 text-slate-500 flex flex-col items-center">
              <Users className="w-12 h-12 mb-3 opacity-20" />
              <p>Chưa có dữ liệu khách hàng.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {customers.map((c, i) => (
                <CustomerItem 
                  key={c.id} 
                  c={c} 
                  index={i} 
                  isEditing={editingId === c.id}
                  onEdit={() => setEditingId(c.id)}
                  onCancel={() => setEditingId(null)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="bg-slate-900 border-t border-slate-700/50 p-4 text-center">
          <p className="text-xs text-slate-500 font-medium">Tổng cộng: {customers.length} khách hàng</p>
        </div>
      </div>
    </div>
  );
}

function CustomerItem({ c, index, isEditing, onEdit, onCancel }: { c: any, index: number, isEditing: boolean, onEdit: () => void, onCancel: () => void }) {
  const { handleUpdateCustomer } = useAppStore();
  const [formData, setFormData] = useState({
    name: c.name || '',
    phone: c.phone || '',
    cccd: c.cccd || '',
    cccd_date: c.cccd_date || '',
    cccd_place: c.cccd_place || '',
    address_hktt: c.address_hktt || '',
    address_current: c.address_current || ''
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleUpdateCustomer(c.id, formData);
    onCancel();
  };

  if (isEditing) {
    return (
      <div className="p-4 rounded-xl bg-slate-800 border border-emerald-500/50 shadow-lg mb-2 relative">
        <h4 className="text-sm font-bold text-emerald-400 mb-3 flex items-center justify-between">
          <span>Cập nhật Khách hàng #{c.id}</span>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </h4>
        <form onSubmit={handleSave} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Tên khách hàng *</label>
            <input required type="text" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value.replace(/[0-9!@#$%\^&*()+=._-]/g, '')}))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Số điện thoại *</label>
            <input required type="text" value={formData.phone} onChange={e => setFormData(p => ({...p, phone: e.target.value.replace(/\D/g, '')}))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500 font-mono" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Số CMND / CCCD</label>
            <input type="text" value={formData.cccd} onChange={e => setFormData(p => ({...p, cccd: e.target.value.replace(/\D/g, '')}))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500 font-mono" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Ngày cấp</label>
            <DatePicker value={formData.cccd_date} onChange={val => setFormData(p => ({...p, cccd_date: val}))} />
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Nơi cấp</label>
            <input type="text" value={formData.cccd_place} onChange={e => setFormData(p => ({...p, cccd_place: e.target.value}))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Nơi ĐKHK thường trú</label>
            <input type="text" value={formData.address_hktt} onChange={e => setFormData(p => ({...p, address_hktt: e.target.value}))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Nơi ở hiện tại</label>
            <input type="text" value={formData.address_current} onChange={e => setFormData(p => ({...p, address_current: e.target.value}))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500" />
          </div>
          
          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs font-bold bg-slate-700 hover:bg-slate-600 rounded text-slate-200">Hủy</button>
            <button type="submit" className="px-3 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded shadow-[0_0_10px_-2px_#10b981]">Lưu Cập Nhật</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-emerald-500/30 transition-colors group">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center font-bold text-slate-300 border border-slate-700 shadow-inner shrink-0">
          {index + 1}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-slate-200 truncate pr-2">{c.name}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
             Mã KH: <span className="text-slate-300 font-mono">#{c.id}</span>
             {c.cccd && <span className="ml-2 text-blue-400">CCCD: {c.cccd}</span>}
             {c.debt && c.debt > 0 ? <span className="ml-2 text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">Nợ cũ: {String(c.debt).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫</span> : null}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800">
          <Phone className="w-3 h-3 text-emerald-400" />
          <span className="font-mono text-sm font-semibold text-slate-300 tracking-wider">
            {c.phone}
          </span>
        </div>
        <button 
          onClick={onEdit}
          className="ml-1 p-2 bg-slate-700/50 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100 outline-none"
          title="Cập nhật thông tin"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
