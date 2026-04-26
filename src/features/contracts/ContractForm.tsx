import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { X, Search, UserPlus, Plus } from 'lucide-react';
import DatePicker from '../../components/ui/DatePicker';

type AssetType = 'Xe máy' | 'Ô tô' | 'Bất động sản' | 'Khác' | '';
type Asset = {
  id: string;
  type: AssetType;
  description: string;
  price: number;
};

function CustomDropdown({
  options,
  value,
  onChange,
  placeholder = "Chọn..."
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-left flex justify-between items-center hover:border-blue-500/50 transition-colors h-[38px] cursor-pointer outline-none"
      >
        <span className={value ? 'text-blue-400 font-bold' : 'text-slate-500 font-medium'}>
          {value || placeholder}
        </span>
        <span className={`text-[10px] text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg shadow-[0_10px_40px_-5px_rgba(0,0,0,0.8)] overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-100">
          <div className="max-h-[200px] overflow-y-auto no-scrollbar py-1">
            {options.map((opt) => (
              <div
                key={opt}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                  value === opt 
                  ? 'bg-blue-500/20 text-blue-400 font-bold' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-blue-200 font-medium'
                }`}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContractForm({ onClose }: { onClose: () => void }) {
  const { handleAddContract, customers } = useAppStore();
  const [loading, setLoading] = useState(false);
  
  // UX: Customer Mode
  const [customerMode, setCustomerMode] = useState<'old' | 'new'>('old');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [loanType, setLoanType] = useState<'Tín chấp' | 'Thế chấp'>('Tín chấp');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [currentAsset, setCurrentAsset] = useState<Partial<Asset>>({ type: '', description: '', price: 0 });

  const [formData, setFormData] = useState({
    phone: '',
    name: '',
    amount: '',
    interestRate: '2000',
    startDate: format(new Date(), 'yyyy-MM-dd')
  });

  const handleSearchCustomer = (val: string) => {
    setSearchQuery(val);
    if (val.trim() === '') {
      setShowSuggestions(false);
      return;
    }
    const searchLower = val.toLowerCase();
    const matched = customers.filter(c => 
      c.name.toLowerCase().includes(searchLower) || c.phone.includes(searchLower)
    ).slice(0, 5);
    setSuggestions(matched);
    setShowSuggestions(true);
  };

  const selectCustomer = (c: any) => {
    setFormData(prev => ({ ...prev, name: c.name, phone: c.phone }));
    setSearchQuery(`${c.name} - ${c.phone}`);
    setShowSuggestions(false);
  };

  const totalAssetPrice = assets.reduce((sum, a) => sum + (a.price || 0), 0);

  useEffect(() => {
    if (loanType === 'Thế chấp') {
      const formatted = totalAssetPrice > 0 ? totalAssetPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : '';
      setFormData(prev => ({...prev, amount: formatted}));
    }
  }, [assets, loanType, totalAssetPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customerMode === 'old' && (!formData.phone || !formData.name)) {
      toast.error('Vui lòng chọn khách hàng cũ từ danh sách!');
      return;
    }
    if (customerMode === 'new' && (!formData.phone || !formData.name)) {
      toast.error('Vui lòng điền đủ Tên và SĐT khách mới!');
      return;
    }
    if (!formData.startDate) {
      toast.error('Vui lòng chọn ngày cầm!');
      return;
    }
    if (loanType === 'Tín chấp' && !formData.amount) {
      toast.error('Vui lòng nhập số tiền vay!');
      return;
    }
    if (loanType === 'Thế chấp' && assets.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 tài sản thế chấp!');
      return;
    }

    setLoading(true);
    try {
      const finalAmount = loanType === 'Thế chấp' ? totalAssetPrice : Number(formData.amount.replace(/\./g, ''));
      const finalAssetStr = loanType === 'Thế chấp' ? JSON.stringify(assets) : 'Tín chấp';

      await handleAddContract({
        ...formData,
        asset: finalAssetStr,
        amount: finalAmount,
        interestRate: Number(formData.interestRate),
      });
      toast.success('Đã tạo Hợp đồng mới');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi: Không thể tạo hợp đồng. Vui lòng kiểm tra lại!');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsset = (addNext: boolean) => {
    if (!currentAsset.description || !currentAsset.price || !currentAsset.type) {
      toast.error('Vui lòng chọn Loại tài sản, nhập Mô tả và Giá cầm!');
      return;
    }
    const newAsset = { 
      ...currentAsset, 
      id: Math.random().toString(36).substring(7) 
    } as Asset;
    
    setAssets([...assets, newAsset]);
    setCurrentAsset({ type: '', description: '', price: 0 });
    
    if (addNext) {
      toast.success('Đã thêm 1 tài sản. Nhập tiếp!');
    } else {
      setShowAssetForm(false);
    }
  };

  const calculateDailyInterest = () => {
    const amount = loanType === 'Thế chấp' ? totalAssetPrice : Number(formData.amount.replace(/\./g, ''));
    if (!amount || !formData.interestRate) return 0;
    return (amount / 1000000) * Number(formData.interestRate);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[95vh]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
      
      {/* Header */}
      <div className="flex justify-between items-center p-5 border-b border-slate-800 shrink-0">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded-lg"><Plus className="w-5 h-5" /></span>
          Lập Hợp Đồng Mới
        </h3>
        <button 
          onClick={onClose}
          type="button"
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="overflow-y-auto p-5 no-scrollbar flex-1 pb-32">
        <form id="contract-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Bước 1: Khách hàng */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wide">
              1. Thông tin Khách Hàng
            </h4>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <div className="flex bg-slate-900 border border-slate-700 p-0.5 rounded-lg h-10 w-full mb-4">
                <button
                  type="button"
                  onClick={() => { setCustomerMode('old'); setFormData(prev => ({...prev, name: '', phone: ''})); setSearchQuery(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 text-sm font-bold rounded-[6px] transition-all duration-200 ${
                    customerMode === 'old' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Search className="w-4 h-4" /> Khách Cũ
                </button>
                <button
                  type="button"
                  onClick={() => { setCustomerMode('new'); setFormData(prev => ({...prev, name: '', phone: ''})); }}
                  className={`flex-1 flex items-center justify-center gap-2 text-sm font-bold rounded-[6px] transition-all duration-200 ${
                    customerMode === 'new' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserPlus className="w-4 h-4" /> Thêm Mới
                </button>
              </div>

              {customerMode === 'old' ? (
                <div className="relative" ref={suggestionsRef}>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                    <input 
                      type="text" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-emerald-500 outline-none transition-colors text-white"
                      placeholder="Tìm theo Tên hoặc Số điện thoại..."
                      value={searchQuery}
                      onChange={e => handleSearchCustomer(e.target.value)}
                    />
                  </div>
                  {showSuggestions && (
                    <div className="absolute top-[100%] left-0 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden z-[100]">
                      <div className="max-h-[200px] overflow-y-auto no-scrollbar py-1">
                        {suggestions.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => selectCustomer(c)}
                            className="px-4 py-3 cursor-pointer transition-colors hover:bg-slate-700 border-b border-slate-700/50 last:border-0"
                          >
                            <div className="text-sm font-bold text-slate-200">{c.name}</div>
                            <div className="text-xs text-slate-400">{c.phone}</div>
                          </div>
                        ))}
                        {suggestions.length === 0 && (
                          <div className="px-4 py-4 text-center text-sm text-slate-400">
                            Không tìm thấy khách hàng. Vui lòng tạo mới!
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-medium">Họ & Tên khách hàng</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none text-white"
                      placeholder="VD: Nguyễn Văn A"
                      value={formData.name}
                      onChange={e => setFormData(prev => ({...prev, name: e.target.value.replace(/[0-9!@#$%\^&*()+=._-]/g, '')}))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-medium">Số điện thoại</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none text-white"
                      placeholder="VD: 0901234567"
                      value={formData.phone}
                      onChange={e => setFormData(prev => ({...prev, phone: e.target.value.replace(/\D/g, '')}))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bước 2: Chi tiết khoản vay */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wide">
              2. Khoản Vay & Lãi Suất
            </h4>
            
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <label className="text-sm text-slate-300 font-bold whitespace-nowrap min-w-[120px]">Hình thức vay</label>
                <div className="flex bg-slate-900 border border-slate-700 p-0.5 rounded-lg h-10 w-full md:w-64">
                  <button
                    type="button"
                    onClick={() => setLoanType('Tín chấp')}
                    className={`flex-1 flex items-center justify-center text-xs font-bold rounded-[6px] transition-all duration-200 ${
                      loanType === 'Tín chấp' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    TÍN CHẤP
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoanType('Thế chấp'); setShowAssetForm(assets.length === 0); }}
                    className={`flex-1 flex items-center justify-center text-xs font-bold rounded-[6px] transition-all duration-200 ${
                      loanType === 'Thế chấp' ? 'bg-blue-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    THẾ CHẤP
                  </button>
                </div>
              </div>

              {loanType === 'Thế chấp' && (
                <div className="p-4 bg-slate-900 border border-blue-900/50 rounded-xl space-y-3">
                  <h5 className="text-xs font-bold text-blue-400 uppercase">Danh sách tài sản thế chấp</h5>
                  {assets.length > 0 && (
                    <div className="flex flex-col gap-2 mb-3">
                      {assets.map((a, i) => (
                        <div key={a.id} className="bg-slate-800/80 border border-slate-700 p-3 rounded-lg flex justify-between items-center group">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-[10px] text-slate-400 border border-slate-700">
                              {i + 1}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-blue-400">[{a.type}]</span>
                              <span className="text-sm text-slate-200">{a.description}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-emerald-400 font-bold">{a.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫</span>
                            <button 
                              type="button" 
                              onClick={() => setAssets(assets.filter(ast => ast.id !== a.id))}
                              className="text-red-400 hover:text-red-300 w-7 h-7 flex items-center justify-center bg-red-500/10 rounded-md transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {showAssetForm ? (
                    <div className="bg-slate-950 border border-blue-500/30 rounded-xl p-4 shadow-inner relative">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block">Loại Tài Sản</label>
                          <CustomDropdown 
                            options={['Xe máy', 'Ô tô', 'Bất động sản', 'Khác']}
                            value={currentAsset.type || ''}
                            onChange={(val) => setCurrentAsset({...currentAsset, type: val as AssetType})}
                            placeholder="Chọn loại..."
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase">Giá cầm (VNĐ)</label>
                          <input 
                            type="text" 
                            placeholder="10.000.000"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none text-emerald-400 font-mono"
                            value={currentAsset.price ? currentAsset.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ''}
                            onChange={e => {
                              const raw = e.target.value.replace(/\D/g, '');
                              setCurrentAsset({...currentAsset, price: Number(raw) || 0});
                            }}
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-[10px] text-slate-400 font-bold uppercase">Mô tả (Biển số, số khung, màu...)</label>
                          <input 
                            type="text"
                            placeholder="Ví dụ: Honda SH 150i, BKS 59A-12345..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none text-slate-200"
                            value={currentAsset.description}
                            onChange={e => setCurrentAsset({...currentAsset, description: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                        {assets.length > 0 && (
                          <button type="button" onClick={() => setShowAssetForm(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-md text-xs font-bold hover:bg-slate-700">
                            Hủy
                          </button>
                        )}
                        <button type="button" onClick={() => handleSaveAsset(true)} className="px-4 py-2 bg-slate-800 border border-blue-500/50 text-blue-400 rounded-md text-xs font-bold hover:bg-blue-500/20">
                          Lưu & Nhập Tiếp
                        </button>
                        <button type="button" onClick={() => handleSaveAsset(false)} className="px-5 py-2 bg-blue-500 text-slate-950 rounded-md text-xs font-bold hover:bg-blue-400">
                          Lưu & Đóng
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      type="button" 
                      onClick={() => setShowAssetForm(true)}
                      className="w-full py-3 border border-dashed border-blue-500/50 rounded-xl text-blue-400 text-sm font-bold hover:bg-blue-500/10 transition-colors"
                    >
                      + THÊM MỚI TÀI SẢN
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Tổng Tiền Vay</label>
                  <div className="relative">
                    <input 
                      required={loanType === 'Tín chấp'}
                      readOnly={loanType === 'Thế chấp'}
                      type="text" 
                      className={`w-full border rounded-lg pl-3 pr-12 py-2 text-base outline-none transition-colors font-bold ${
                        loanType === 'Thế chấp' 
                        ? 'bg-slate-900 border-slate-700 text-blue-400 cursor-not-allowed' 
                        : 'bg-slate-900 border-slate-700 focus:border-emerald-500 text-emerald-400'
                      }`}
                      placeholder="10.000.000"
                      value={formData.amount}
                      onChange={e => {
                        if (loanType === 'Thế chấp') return;
                        const raw = e.target.value.replace(/\D/g, '');
                        if (!raw) {
                          setFormData({...formData, amount: ''});
                          return;
                        }
                        const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                        setFormData({...formData, amount: formatted});
                      }}
                    />
                    <span className="absolute right-3 top-2.5 text-slate-500 font-bold text-sm">VNĐ</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Thoả thuận Lãi</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        required
                        type="text" 
                        className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg pl-3 pr-20 py-2 text-base font-bold text-emerald-400 outline-none"
                        value={formData.interestRate}
                        onChange={e => {
                          let val = e.target.value.replace(/\D/g, '');
                          if (val && Number(val) > 2500) val = '2500';
                          setFormData(prev => ({...prev, interestRate: val}));
                        }}
                      />
                      <span className="absolute right-2 top-2.5 text-[11px] text-slate-500 font-medium">đ/1tr/ngày</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    {['1000', '1500', '2000', '2500'].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setFormData({...formData, interestRate: rate})}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[10px] font-bold transition-colors"
                      >
                        {rate}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1 w-full md:w-1/2">
                <label className="text-xs text-slate-400 font-medium">Ngày Giải Ngân</label>
                <DatePicker 
                  required
                  value={formData.startDate}
                  onChange={val => setFormData({...formData, startDate: val})}
                />
              </div>

            </div>
          </div>
        </form>
      </div>

      {/* Sticky Summary Footer */}
      <div className="absolute bottom-0 left-0 w-full bg-slate-950 border-t border-slate-800 p-4 px-6 flex flex-col md:flex-row justify-between items-center gap-4 z-[60] shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col">
          <div className="text-slate-400 text-xs font-medium">TỔNG VAY: <span className="text-lg font-bold text-emerald-400 ml-1">{formData.amount || '0'} đ</span></div>
          <div className="text-slate-500 text-[11px]">Lãi tạm tính: <span className="text-amber-400 font-bold">{calculateDailyInterest().toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} đ/ngày</span></div>
        </div>
        
        <div className="flex gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-bold transition-colors"
          >
            Hủy Bỏ
          </button>
          <button 
            type="submit" 
            form="contract-form"
            disabled={loading || (loanType === 'Thế chấp' && assets.length === 0)}
            className="px-8 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-lg text-sm font-bold transition-all shadow-[0_0_20px_-5px_#10b981] flex items-center gap-2"
          >
            {loading ? 'ĐANG TẠO...' : 'TẠO HỢP ĐỒNG'}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
