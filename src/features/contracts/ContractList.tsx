import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore, getContractStatus, calculateProfit, calculateDays } from '../../store';
import { Contract } from '../../lib/db';
import { format, parseISO } from 'date-fns';
import { MoreVertical, RotateCcw, Box, AlertTriangle, Coins, ChevronDown, Check, Printer, Edit, Trash2, Bot, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { emit } from '@tauri-apps/api/event';
import ContractPrintView from './ContractPrintView';

import EditContractModal from './components/EditContractModal';
import DeleteContractModal from './components/DeleteContractModal';
import InterestModal from './components/InterestModal';
import InlineLiquidationForm from './components/InlineLiquidationForm';
import LiquidationActionModal from './components/LiquidationActionModal';
import AutoCalcModal from './components/AutoCalcModal';

export default function ContractList() {
  const { contracts, searchQuery, liquidations, customers } = useAppStore();
  const [activeTab, setActiveTab] = useState<'Đang chờ' | 'Quá hạn' | 'Đã xong' | 'Thanh Lý' | 'Khách nợ'>('Đang chờ');
  const [sortFilter, setSortFilter] = useState<'due' | 'newest' | 'oldest'>('due');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [page, setPage] = useState(1);
  const [liquidatingContract, setLiquidatingContract] = useState<Contract | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPage(1);
  }, [activeTab, sortFilter, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    }
    if (showSortMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSortMenu]);

  const removeAccents = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const matchSearch = (c: Contract, query: string) => {
    if (!query) return true;
    const q = removeAccents(query.toLowerCase().trim());
    return removeAccents((c.customer_name || '').toLowerCase()).includes(q) 
      || (c.customer_phone || '').includes(q) 
      || (c.id || '').toLowerCase().includes(q);
  };

  const customerDict = useMemo(() => {
    const dict = new Map<number, any>();
    for (const cus of customers) {
      dict.set(cus.id, cus);
    }
    return dict;
  }, [customers]);

  const liquidationDict = useMemo(() => {
    const dict = new Map<string, any>();
    for (const liq of liquidations) {
      dict.set(liq.contract_id, liq);
    }
    return dict;
  }, [liquidations]);

  // Filter and Sort
  const filtered = contracts.filter(c => {
    const status = getContractStatus(c);
    let stMatch = status === activeTab;
    if (activeTab === 'Khách nợ') {
       const cus = customerDict.get(c.customer_id);
       stMatch = !!(cus && cus.debt && cus.debt > 0);
    }
    
    return stMatch && matchSearch(c, searchQuery);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortFilter === 'newest') {
      return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
    }
    if (sortFilter === 'oldest') {
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    }
    const daysA = calculateDays(a);
    const daysB = calculateDays(b);
    return daysB - daysA;
  });

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const currentItems = sorted.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Count stats
  const getStats = (status: string) => {
    let list = [];
    if (status === 'Khách nợ') {
       list = contracts.filter(c => {
         const cus = customerDict.get(c.customer_id);
         return cus && cus.debt && cus.debt > 0 && matchSearch(c, searchQuery);
       });
    } else {
       list = contracts.filter(c => getContractStatus(c) === status && matchSearch(c, searchQuery));
    }
    const total = list.length;
    let unsecured = 0;
    let secured = 0;
    let pendingLiq = 0;
    let doneLiq = 0;
    
    list.forEach(c => {
      const safeAsset = (c.asset || '').toLowerCase().trim();
      const isUnsecured = !c.asset || c.asset === 'Tín chấp' || safeAsset === 'không có' || safeAsset === 'khong co';
      if (isUnsecured) unsecured++;
      else secured++;

      if (status === 'Thanh Lý') {
        const liq = liquidationDict.get(c.id);
        if (liq?.status === 'Đã thanh lý') doneLiq++;
        else pendingLiq++;
      }
    });
    return { total, unsecured, secured, pendingLiq, doneLiq };
  };

  return (
    <div className="flex flex-col gap-4 pb-8 h-full">
      <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-slate-800 shrink-0 overflow-x-auto hide-scrollbar">
        {(['Đang chờ', 'Quá hạn', 'Khách nợ', 'Đã xong', 'Thanh Lý'] as const).map(tab => {
          const stats = getStats(tab);
          const isActive = activeTab === tab;
          
          let unsecuredColor = 'text-rose-400';
          let securedColor = 'text-blue-400';

          if (isActive) {
            if (tab === 'Đang chờ') { // bg-emerald-500 text-slate-950
              unsecuredColor = 'text-rose-700 font-bold'; securedColor = 'text-teal-900 font-bold';
            } else if (tab === 'Quá hạn') { // bg-red-500 text-white
              unsecuredColor = 'text-red-100 font-bold'; securedColor = 'text-blue-100 font-bold';
            } else if (tab === 'Thanh Lý') { // bg-amber-500 text-slate-900
              unsecuredColor = 'text-amber-800 font-bold'; securedColor = 'text-amber-900 font-bold';
            } else { // bg-slate-700 text-slate-200
              unsecuredColor = 'text-rose-400 font-bold'; securedColor = 'text-blue-400 font-bold';
            }
          }

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition-all duration-200 min-w-[100px] ${
                isActive 
                ? (tab === 'Quá hạn' ? 'bg-red-500 text-slate-100 shadow-md' : tab === 'Khách nợ' ? 'bg-rose-500 text-white shadow-md' : tab === 'Đã xong' ? 'bg-slate-700 text-slate-200 shadow-md' : tab === 'Thanh Lý' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'bg-emerald-500 text-slate-950 shadow-md')
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="text-sm font-semibold">{tab} {stats.total > 0 && `(${stats.total})`}</div>
              {stats.total > 0 && (
                <div className="flex gap-2 mt-1 text-[10px] font-bold items-center opacity-90">
                  {tab === 'Thanh Lý' ? (
                     <>
                       <span className={`${unsecuredColor} px-1.5 py-0.5 bg-white/10 rounded-sm`} title="Đang chờ thanh lý">Đang chờ: {stats.pendingLiq}</span>
                       <span className={`${securedColor} px-1.5 py-0.5 bg-white/10 rounded-sm`} title="Đã thanh lý xong">Đã xong: {stats.doneLiq}</span>
                     </>
                  ) : (
                    <>
                      <span className={`${unsecuredColor} px-1.5 py-0.5 bg-white/10 rounded-sm`} title="Hợp đồng Tín Chấp">Tín chấp: {stats.unsecured}</span>
                      <span className={`${securedColor} px-1.5 py-0.5 bg-white/10 rounded-sm`} title="Hợp đồng Thế Chấp">Thế chấp: {stats.secured}</span>
                    </>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-1 shrink-0 relative">
        <h2 className="text-sm font-bold text-slate-300">Danh sách hợp đồng</h2>
        
        <div className="relative z-50" ref={sortRef}>
          <button 
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm"
          >
            {sortFilter === 'due' ? 'Ngày vay sắp tới hạn' : sortFilter === 'newest' ? 'Ngày vay Mới nhất' : 'Ngày vay Cũ nhất'}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showSortMenu ? 'rotate-180' : ''}`} />
          </button>

          {showSortMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-1 flex flex-col">
                <button 
                  onClick={() => { setSortFilter('due'); setShowSortMenu(false); }}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${sortFilter === 'due' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                  Ngày vay sắp tới hạn {sortFilter === 'due' && <Check className="w-4 h-4" />}
                </button>
                <div className="h-[1px] bg-slate-700/50 my-0.5 mx-1"></div>
                <button 
                  onClick={() => { setSortFilter('newest'); setShowSortMenu(false); }}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${sortFilter === 'newest' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                  Ngày vay Mới nhất {sortFilter === 'newest' && <Check className="w-4 h-4" />}
                </button>
                <div className="h-[1px] bg-slate-700/50 my-0.5 mx-1"></div>
                <button 
                  onClick={() => { setSortFilter('oldest'); setShowSortMenu(false); }}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${sortFilter === 'oldest' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                  Ngày vay Cũ nhất {sortFilter === 'oldest' && <Check className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar relative border-t border-slate-800/50 mt-1">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-md z-40 shadow-sm">
            <tr className="border-b border-slate-800">
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-1/4">Khách Hàng</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-1/4">Tài Sản Cầm Cố</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Khoản Vay</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Tiến Độ / Lãi</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center w-16">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {currentItems.map(c => (
              <ContractItem key={c.id} contract={c} onLiquidate={(contract) => setLiquidatingContract(contract)} />
            ))}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="text-center py-20 text-slate-500 flex flex-col items-center">
            <Box className="w-12 h-12 mb-3 opacity-20" />
            <p className="mb-4">Không có hợp đồng {activeTab.toLowerCase()}.</p>
            {activeTab === 'Đang chờ' && (
              <button 
                onClick={() => emit('open-create-contract')}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-emerald-900/40"
              >
                <Plus className="w-4 h-4" />
                Lập Hợp Đồng Ngay
              </button>
            )}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-2 shrink-0 bg-slate-900/40 p-2 rounded-xl border border-slate-800/60">
          <button 
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 shadow-md disabled:opacity-40 disabled:shadow-none transition text-slate-300 rounded font-medium text-xs"
          >
            Trang trước
          </button>
          <span className="text-[11px] text-emerald-400 font-bold tracking-wider uppercase">Trang {page} / {totalPages}</span>
          <button 
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 shadow-md disabled:opacity-40 disabled:shadow-none transition text-slate-300 rounded font-medium text-xs"
          >
            Trang sau
          </button>
        </div>
      )}

      {liquidatingContract && createPortal(
        <LiquidationActionModal 
          contract={liquidatingContract} 
          onClose={() => setLiquidatingContract(null)}
          onSuccess={() => {
            setLiquidatingContract(null);
            setActiveTab('Thanh Lý');
          }}
        />,
        document.body
      )}
    </div>
  );
}

function ContractItem({ contract, onLiquidate }: { contract: Contract, onLiquidate?: (c: Contract) => void }) {
  const { handleCheckout, contracts, currentUser, customers } = useAppStore();
  const customer = customers.find(c => c.id === contract.customer_id);
  const [menuPos, setMenuPos] = useState<{x: number, y: number} | null>(null);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAutoCalcModal, setShowAutoCalcModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const totalCustomerUnsecured = contracts
    .filter(c => c.customer_phone === contract.customer_phone)
    .filter(c => {
      const st = getContractStatus(c);
      return st === 'Đang chờ' || st === 'Quá hạn';
    })
    .filter(c => {
      const safeA = (c.asset || '').toLowerCase().trim();
      return !c.asset || c.asset === 'Tín chấp' || safeA === 'không có' || safeA === 'khong co';
    })
    .reduce((sum, c) => sum + c.amount, 0);

  const isHighRiskUnsecured = totalCustomerUnsecured >= 100000000;

  // click outside is handled by the portal backdrop

  const status = getContractStatus(contract);
  const profit = calculateProfit(contract);
  const currentDays = calculateDays(contract);
  
  let finalProfit = 0;
  let finalDays = 0;
  if (status === 'Đã xong' && contract.last_paid_date) {
    try {
      finalProfit = calculateProfit(contract, parseISO(contract.last_paid_date));
      finalDays = calculateDays(contract, parseISO(contract.last_paid_date));
    } catch(e) {}
  } else {
    finalProfit = profit;
    finalDays = currentDays;
  }
  
  const displayDays = status === 'Đã xong' ? finalDays : currentDays;
  
  const isActive = status === 'Đang chờ' || status === 'Quá hạn';
  const isOverdue = status === 'Quá hạn';

  const formatCurrency = (num: number) => {
    return String(Math.floor(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ' ₫';
  };

  const actionAction = async (type: 'interest' | 'checkout' | 'liquidate' | 'delete' | 'edit' | 'auto_calc') => {
    setMenuPos(null);
    
    if (type === 'liquidate') {
      const safeA = (contract.asset || '').toLowerCase().trim();
      if (!contract.asset || contract.asset === 'Tín chấp' || safeA === 'không có' || safeA === 'khong co') {
        toast.error('Từ chối thao tác: Hợp đồng TÍN CHẤP (không có tài sản thế chấp) không thể thực hiện Thanh Lý!');
        return;
      }
      if (onLiquidate) onLiquidate(contract);
      return;
    }

    if (type === 'interest') {
      setShowInterestModal(true);
      return;
    }

    if (type === 'delete') {
      setShowDeleteModal(true);
      return;
    }

    if (type === 'auto_calc') {
      setShowAutoCalcModal(true);
      return;
    }

    if (type === 'edit') {
      setShowEditModal(true);
      return;
    }

    const payDateStr = prompt('Nhập ngày thanh toán (YYYY-MM-DD):', format(new Date(), 'yyyy-MM-dd'));
    if (!payDateStr) return;

    try {
      if (type === 'checkout') {
        await handleCheckout(contract.id, payDateStr);
        toast.success('Đã tất toán và trả tài sản');
      }
    } catch (e) {
      toast.error('Có lỗi xảy ra');
    }
  };

  return (
    <>
      <tr 
        onContextMenu={(e) => {
          if (isActive) {
            e.preventDefault();
            e.stopPropagation();
            setMenuPos({ x: e.clientX, y: e.clientY });
          }
        }}
        className={`group transition-colors relative cursor-default ${
          isOverdue ? 'bg-red-950/10 hover:bg-red-950/20' : 
          status === 'Thanh Lý' ? 'bg-amber-900/10 hover:bg-amber-900/20' : 
          status === 'Đã xong' ? 'opacity-60 hover:opacity-80' : 'hover:bg-slate-800/60'
        }`}
      >
        {/* Khách Hàng */}
        <td className="px-4 py-3 align-top whitespace-normal relative">
          {isOverdue && (
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 z-10"></div>
          )}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-emerald-400">{contract.customer_name}</span>
              {isOverdue && (
                <span className="flex items-center gap-1 text-[9px] uppercase font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                  <AlertTriangle className="w-3 h-3" /> Quá hạn
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
              <span>{contract.customer_phone}</span>
              {(customer?.debt && customer.debt > 0) ? (
                <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                  Nợ cũ: {formatCurrency(customer.debt)}
                </span>
              ) : null}
            </div>
            {isHighRiskUnsecured && (
              <span className="text-[9px] uppercase font-bold text-rose-400 w-fit">⚠ Tín chấp rủi ro cao</span>
            )}
          </div>
        </td>

        {/* Tài Sản Cầm Cố */}
        <td className="px-4 py-3 align-top whitespace-normal">
          <div className="text-xs text-slate-300">
            {(() => {
              const safeAsset = (contract.asset || '').toLowerCase().trim();
              if (!contract.asset || contract.asset === 'Tín chấp' || safeAsset === 'không có' || safeAsset === 'khong co') {
                return <span className="text-rose-400 font-bold uppercase text-[10px]">Tín Chấp (Không TS)</span>;
              }
              try {
                const parsed = JSON.parse(contract.asset) as any[];
                if (Array.isArray(parsed) && parsed.length > 0) {
                  return (
                    <div className="flex flex-col gap-1">
                      {parsed.slice(0, 2).map((a: any, i: number) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">
                            {a.type}
                          </span>
                          <span className="truncate max-w-[150px]">{a.description}</span>
                        </div>
                      ))}
                      {parsed.length > 2 && <span className="text-[10px] text-slate-500">+{parsed.length - 2} TS khác</span>}
                    </div>
                  );
                }
              } catch (e) {
                return <span className="line-clamp-2 max-w-[200px]">{contract.asset}</span>;
              }
            })()}
          </div>
        </td>

        {/* Khoản Vay */}
        <td className="px-4 py-3 align-top text-right whitespace-normal">
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-sm font-bold text-slate-100">{formatCurrency(contract.amount)}</span>
            <span className="text-[10px] text-slate-500 font-mono">Mã: {contract.id}</span>
            <span className="text-[10px] text-slate-400">Lãi: <span className="text-emerald-400 font-mono font-bold">{formatCurrency(contract.interest_rate)}</span>/ngày/tr</span>
          </div>
        </td>

        {/* Tiến Độ / Lãi */}
        <td className="px-4 py-3 align-top text-right whitespace-normal">
          <div className="flex flex-col items-end gap-1">
            <div className={`font-mono text-sm font-bold ${isActive ? 'text-amber-400' : status === 'Đã xong' ? 'text-emerald-400' : 'text-slate-500'}`}>
              {isActive ? `+${formatCurrency(profit)}` : status === 'Đã xong' ? `+${formatCurrency(finalProfit)}` : '---'}
            </div>
            {(isActive || status === 'Đã xong') && (
              <div className="flex flex-col items-end w-full max-w-[120px] mt-1">
                <span className={`text-[10px] ${isOverdue ? 'text-red-400' : status === 'Đã xong' ? 'text-emerald-500' : 'text-slate-400'} mb-1`}>
                  {isOverdue ? `Trễ ${displayDays - 30} ngày` : status === 'Đã xong' ? `Xong` : `${displayDays} / 30 ngày`}
                </span>
                {status !== 'Đã xong' && (
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${isOverdue ? 'bg-red-500' : displayDays > 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, (displayDays / 30) * 100)}%` }}
                    ></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </td>

        {/* Thao tác */}
        <td className="px-4 py-3 align-top text-center">
          <div className="flex justify-center relative" ref={menuRef}>
            {(isActive || currentUser?.role === 'admin') ? (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (menuPos) setMenuPos(null);
                  else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenuPos({ x: rect.left - 180, y: rect.bottom + 4 }); // Dropdown to the left
                  }
                }}
                className={`p-1.5 rounded-lg transition ${menuPos ? 'bg-slate-700 text-white' : 'hover:bg-slate-700 text-slate-400 hover:text-white'}`}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            ) : (
              <span className="text-[10px] px-2 py-1 bg-slate-800 rounded text-slate-500">{status}</span>
            )}
          </div>
        </td>
      </tr>

      {/* Menu dropdown is still rendered in portal */}
      {menuPos && createPortal(
        <div 
          className="fixed inset-0 z-[99999]" 
          onClick={(e) => { e.stopPropagation(); setMenuPos(null); }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenuPos(null); }}
        >
          <div 
            className="fixed bg-slate-800/95 border border-slate-700/80 p-1.5 rounded-xl shadow-2xl flex flex-col backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 w-52"
            style={{ 
              top: Math.min(menuPos.y, window.innerHeight - 160), 
              left: Math.max(10, Math.min(menuPos.x, window.innerWidth - 220))
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-2 py-1 mb-1 border-b border-slate-700/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Thao tác Hợp đồng
            </div>
            <button
              onClick={() => { setMenuPos(null); setShowPrintModal(true); }}
              className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-700/50 text-slate-200 rounded-lg text-sm font-medium text-left transition group"
            >
              <Printer className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" /> Xuất Hợp Đồng
            </button>
            {isActive && (
              <>
                <button
                  onClick={() => actionAction('interest')}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-700/50 text-slate-200 rounded-lg text-sm font-medium text-left transition group"
                >
                  <RotateCcw className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" /> Đóng lãi | Tất toán
                </button>
                <button
                  onClick={() => actionAction('auto_calc')}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium text-left transition group"
                >
                  <Bot className="w-4 h-4 group-hover:scale-110 transition-transform" /> Trợ lý Tính Toán
                </button>
                <div className="h-[1px] bg-slate-700/50 my-0.5 mx-2"></div>
                <button
                  onClick={() => actionAction('liquidate')}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-orange-500/10 text-orange-400 rounded-lg text-sm font-medium text-left transition group"
                >
                  <Coins className="w-4 h-4 group-hover:scale-110 transition-transform" /> Thanh Lý (Thu hồi)
                </button>
              </>
            )}
            {currentUser?.role === 'admin' && status !== 'Đã xong' && (
              <>
                <div className="h-[1px] bg-slate-700/50 my-0.5 mx-2"></div>
                <button
                  onClick={() => actionAction('edit')}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-700/50 text-slate-200 rounded-lg text-sm font-medium text-left transition group"
                >
                  <Edit className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" /> Sửa Hợp Đồng
                </button>
                <button
                  onClick={() => actionAction('delete')}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-red-500/10 text-red-400 rounded-lg text-sm font-medium text-left transition group"
                >
                  <Trash2 className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" /> Xoá Hợp Đồng
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {status === 'Thanh Lý' && (
        <tr>
          <td colSpan={5} className="px-4 pb-4 pt-2 border-t border-dashed border-amber-500/20 bg-amber-900/5">
            <InlineLiquidationForm contract={contract} />
          </td>
        </tr>
      )}

      {showPrintModal && createPortal(
        <ContractPrintView contract={contract} onClose={() => setShowPrintModal(false)} />,
        document.body
      )}

      {showInterestModal && createPortal(
        <InterestModal contract={contract} onClose={() => setShowInterestModal(false)} />,
        document.body
      )}

      {showEditModal && createPortal(
        <EditContractModal contract={contract} onClose={() => setShowEditModal(false)} />,
        document.body
      )}

      {showDeleteModal && createPortal(
        <DeleteContractModal contract={contract} onClose={() => setShowDeleteModal(false)} />,
        document.body
      )}

      {showAutoCalcModal && createPortal(
        <AutoCalcModal contract={contract} onClose={() => setShowAutoCalcModal(false)} />,
        document.body
      )}
    </>
  );
}












