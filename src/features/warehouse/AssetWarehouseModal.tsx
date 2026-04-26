import { useState, useMemo } from 'react';
import { useAppStore, getContractStatus, calculateProfit } from '../../store';
import { X, Box, Car, Home, Package, ShieldCheck, ShoppingCart, ListPlus, Coins, CheckCircle2, Search, DollarSign, Wallet } from 'lucide-react';
import { parseISO } from 'date-fns';

interface AssetStat {
  type: string;
  statusCategory: 'holding' | 'liquidated' | 'returned';
}

export default function AssetWarehouseModal({ onClose }: { onClose: () => void }) {
  const { contracts, liquidations } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');

  const { totalDoneProfit, totalLiqProfit, searchResults } = useMemo(() => {
    let doneProfit = 0;
    let liqProfit = 0;
    const results: any[] = [];
    const term = searchTerm.toLowerCase().trim();

    contracts.forEach(c => {
      const rawStatus = getContractStatus(c);
      if (rawStatus === 'Đã xong') {
        let p = 0;
        if (c.last_paid_date) {
          try {
            p = calculateProfit(c, parseISO(c.last_paid_date));
          } catch(e) {}
        } else {
          p = calculateProfit(c);
        }
        doneProfit += p;

        if (term && (c.customer_name?.toLowerCase().includes(term) || c.customer_phone?.includes(term))) {
          results.push({ ...c, finalProfit: p, profitType: 'Lãi vay' });
        }
      }
    });

    liquidations.forEach(l => {
      if (l.status === 'Đã thanh lý' && l.liquidation_price) {
        const p = l.liquidation_price - l.loan_amount;
        liqProfit += p;
        
        if (term) {
          const c = contracts.find(ct => ct.id === l.contract_id);
          // Tránh thêm trùng hợp đồng nếu hợp đồng vừa có lãi vừa có thanh lý (có thể tách biệt dòng tiền)
          if (c && (c.customer_name?.toLowerCase().includes(term) || c.customer_phone?.includes(term))) {
            results.push({ ...c, finalProfit: p, profitType: 'Thanh lý tài sản' });
          }
        }
      }
    });

    return { totalDoneProfit: doneProfit, totalLiqProfit: liqProfit, searchResults: results };
  }, [contracts, liquidations, searchTerm]);

  const assets = useMemo(() => {
    const list: AssetStat[] = [];
    contracts.forEach(c => {
      const safeA = (c.asset || '').toLowerCase().trim();
      if (!c.asset || c.asset === 'Tín chấp' || safeA === 'không có' || safeA === 'khong co') {
        return; // Skip unsecured
      }

      const rawStatus = getContractStatus(c);
      let statusCategory: AssetStat['statusCategory'] = 'holding';
      if (rawStatus === 'Thanh Lý') statusCategory = 'liquidated';
      else if (rawStatus === 'Đã xong') statusCategory = 'returned';

      try {
        const parsed = JSON.parse(c.asset);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach(a => {
            const rawType = a.type || 'Khác';
            // Normalize type string
            let normalizedType = 'Khác';
            if (rawType.toLowerCase().includes('xe máy')) normalizedType = 'Xe máy';
            else if (rawType.toLowerCase().includes('ô tô')) normalizedType = 'Ô tô';
            else if (rawType.toLowerCase().includes('bất động sản')) normalizedType = 'Bất động sản';

            list.push({ type: normalizedType, statusCategory });
          });
          return;
        }
      } catch (e) {
        // Not a JSON array, treat as a single string item (probably 'Khác')
      }

      // Fallback if parsing fails or plain string
      let normalizedType = 'Khác';
      if (safeA.includes('xe máy')) normalizedType = 'Xe máy';
      else if (safeA.includes('ô tô')) normalizedType = 'Ô tô';
      else if (safeA.includes('bất động sản')) normalizedType = 'Bất động sản';
      list.push({ type: normalizedType, statusCategory });
    });
    return list;
  }, [contracts]);

  const typeOrder = ['Xe máy', 'Ô tô', 'Bất động sản', 'Khác'];

  const getStats = (cat?: AssetStat['statusCategory']) => {
    const filtered = cat ? assets.filter(a => a.statusCategory === cat) : assets;
    const byType: Record<string, number> = {};
    typeOrder.forEach(t => byType[t] = 0);
    
    filtered.forEach(a => {
      if (byType[a.type] !== undefined) byType[a.type]++;
      else byType['Khác']++;
    });

    return { total: filtered.length, byType };
  };

  const totalStats = getStats();
  const holdingStats = getStats('holding');
  const liquidatedStats = getStats('liquidated');
  const returnedStats = getStats('returned');

  const getIcon = (type: string) => {
    if (type === 'Xe máy') return <ShoppingCart className="w-5 h-5 text-blue-400" />; 
    if (type === 'Ô tô') return <Car className="w-5 h-5 text-purple-400" />;
    if (type === 'Bất động sản') return <Home className="w-5 h-5 text-emerald-400" />;
    return <Package className="w-5 h-5 text-slate-400" />;
  };

  const formatCurrency = (num: number) => {
    return String(Math.floor(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ' ₫';
  };

  const StatBlock = ({ title, stats, icon, colorClass, borderClass }: { title: string, stats: any, icon: React.ReactNode, colorClass: string, borderClass: string }) => (
    <div className={`bg-slate-800/60 rounded-xl p-5 border ${borderClass} flex flex-col relative overflow-hidden group`}>
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 ${colorClass.replace('text-', 'bg-')}`}></div>
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className={`p-2 rounded-lg ${colorClass.replace('text-', 'bg-').replace('500', '500/20').replace('400', '400/20')}`}>
          {icon}
        </div>
        <div>
          <h4 className="font-bold text-slate-200 text-sm tracking-wide">{title}</h4>
          <div className={`text-2xl font-black ${colorClass}`}>{stats.total}</div>
        </div>
      </div>
      
      <div className="flex flex-col gap-2 relative z-10 flex-1">
        {typeOrder.map(type => stats.byType[type] > 0 && (
          <div key={type} className="flex items-center justify-between bg-slate-950/40 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-2">
               {getIcon(type)} {type}
            </span>
            <span className="text-sm font-bold bg-slate-900 px-2 py-0.5 rounded shadow-inner">{stats.byType[type]}</span>
          </div>
        ))}
        {stats.total === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 bg-slate-950/20 border border-slate-800/50 px-3 py-2 rounded-lg text-xs italic text-slate-500 min-h-[140px] w-full">
            <Package className="w-8 h-8 mb-2 opacity-20" />
            Không có dữ liệu
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-800/80 p-5 border-b border-slate-700/50 flex justify-between items-center shrink-0 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
           <div className="flex items-center gap-3 relative z-10">
              <div className="p-2.5 bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-teal-500/30 rounded-xl shadow-lg">
                 <Wallet className="w-6 h-6 text-teal-400" />
              </div>
              <div>
                 <h2 className="text-xl font-bold text-white tracking-tight">Tổng quan Dòng Tiền & Kho Tài Sản</h2>
                 <p className="text-xs text-slate-400 font-medium">Báo cáo doanh thu và tình trạng tài sản đã cầm cố</p>
              </div>
           </div>
           <button 
             onClick={onClose}
             className="relative z-10 p-2 rounded-xl text-slate-400 hover:bg-slate-700/80 hover:text-white transition-all shadow-sm border border-transparent hover:border-slate-600 focus:outline-none"
           >
             <X className="w-5 h-5" />
           </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col gap-8">
          
          {/* SECTION 1: DÒNG TIỀN */}
          <div>
            <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-400" />
              Tổng Quan Dòng Tiền
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tổng Lợi Nhuận (Đã Xong)</div>
                  <div className="text-2xl font-black text-emerald-400">+{formatCurrency(totalDoneProfit)}</div>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-full">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Lợi Nhuận Thanh Lý</div>
                  <div className="text-2xl font-black text-amber-400">+{formatCurrency(totalLiqProfit)}</div>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-full">
                  <Coins className="w-6 h-6 text-amber-500" />
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex flex-col justify-center">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Tìm kiếm K/H (Tên, SĐT)..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:border-teal-500 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* KẾT QUẢ TÌM KIẾM DÒNG TIỀN */}
            {searchTerm.trim() !== '' && (
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden mb-5">
                <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Kết quả tìm kiếm cho: "{searchTerm}"</span>
                  <span className="text-xs text-slate-400">{searchResults.length} giao dịch</span>
                </div>
                {searchResults.length > 0 ? (
                  <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                    {searchResults.map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 border-b border-slate-700/30 hover:bg-slate-800/50 transition">
                        <div>
                          <div className="font-bold text-slate-200">{r.customer_name} <span className="text-slate-500 font-mono text-sm ml-2">{r.customer_phone}</span></div>
                          <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                            Mã HĐ: <span className="font-mono">{r.id}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                            Nguồn: <span className={r.profitType === 'Lãi vay' ? 'text-emerald-400' : 'text-amber-400'}>{r.profitType}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono font-bold ${r.profitType === 'Lãi vay' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            +{formatCurrency(r.finalProfit)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 flex flex-col items-center justify-center text-slate-500">
                    <Search className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">Không tìm thấy giao dịch nào mang lại lợi nhuận từ khách hàng này.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: TÀI SẢN KHO */}
          <div>
            <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Box className="w-5 h-5 text-teal-400" />
              Tài Sản Đang Lưu Kho
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatBlock 
                title="Tổng Đã Từng Nhận" 
                stats={totalStats} 
                icon={<ListPlus className="w-6 h-6 text-indigo-400" />} 
                colorClass="text-indigo-400"
                borderClass="border-indigo-500/30"
              />
              <StatBlock 
                title="Đang Cầm Trực Tiếp" 
                stats={holdingStats} 
                icon={<ShieldCheck className="w-6 h-6 text-emerald-400" />} 
                colorClass="text-emerald-500"
                borderClass="border-emerald-500/30"
              />
              <StatBlock 
                title="Đã Bị Thanh Lý" 
                stats={liquidatedStats} 
                icon={<Coins className="w-6 h-6 text-amber-500" />} 
                colorClass="text-amber-500"
                borderClass="border-amber-500/30"
              />
              <StatBlock 
                title="Đã Chuộc (Trả Khách)" 
                stats={returnedStats} 
                icon={<CheckCircle2 className="w-6 h-6 text-slate-400" />} 
                colorClass="text-blue-400"
                borderClass="border-blue-500/30"
              />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
