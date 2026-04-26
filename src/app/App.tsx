import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore, calculateProfit, getContractStatus } from '../store';
import { Plus, Search, Users, Package, Settings, LogOut, TrendingUp, AlertCircle, DollarSign, RefreshCw, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import BackgroundAnimation from '../components/ui/BackgroundAnimation';
import ContractForm from '../features/contracts/ContractForm';
import ContractList from '../features/contracts/ContractList';
import CustomerModal from '../features/customers/CustomerModal';
import AssetWarehouseModal from '../features/warehouse/AssetWarehouseModal';
import LoginView from '../features/auth/LoginView';
import AdminPanel from '../features/admin/AdminPanel';
import { initDb } from '../lib/db';
import { listen } from '@tauri-apps/api/event';

function App() {
  const { fetchData, searchQuery, setSearchQuery, currentUser, setCurrentUser, fetchSettings, contracts, isBotRunning, startBot } = useAppStore();
  const [adminInitialTab, setAdminInitialTab] = useState<'settings' | 'users' | 'ai'>('settings');
  const [showForm, setShowForm] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const [showWarehouse, setShowWarehouse] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [systemContextMenu, setSystemContextMenu] = useState<{ x: number; y: number } | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Prevent the default Tauri/browser context menu (Inspect Element, etc)
      e.preventDefault();
      setSystemContextMenu({ x: e.clientX, y: e.clientY });
    };
    const handleClick = () => setSystemContextMenu(null);
    
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  useEffect(() => {
    initDb().then(() => {
      setIsDbReady(true);
      fetchSettings();
      checkForAppUpdates();
    }).catch(e => {
      console.error(e);
      setErrorMsg(String(e));
    });

    const unlisten = listen('open-create-contract', () => {
      setShowForm(true);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const checkForAppUpdates = async () => {
    try {
      const update = await check();
      if (update) {
        toast.loading(`Đang tải bản cập nhật ${update.version}... Vui lòng không tắt máy.`, { duration: 10000 });
        await update.downloadAndInstall();
        toast.success('Cập nhật thành công! Đang khởi động lại...');
        await relaunch();
      }
    } catch (e) {
      console.error('Failed to check for updates:', e);
    }
  };

  useEffect(() => {
    if (isDbReady && currentUser) {
      startBot().then(success => {
         if (success) {
            toast.success('AI Telegram Agent đã tự động kết nối!');
         } else {
            const { settings } = useAppStore.getState();
            if (settings.ai_telegram_token) {
               toast.error('Không thể tự động bật AI Bot. Vui lòng kiểm tra lại cấu hình.');
            }
         }
      });
    }
  }, [isDbReady, currentUser]);

  useQuery({
    queryKey: ['appData'],
    queryFn: async () => {
      await fetchData();
      return true;
    },
    enabled: isDbReady,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  if (errorMsg) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <h2 className="text-red-400 font-bold mb-2">Lỗi khởi tạo CSDL</h2>
        <p className="text-slate-400 font-mono text-sm">{errorMsg}</p>
      </div>
    );
  }

  if (!isDbReady) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginView />
      </>
    );
  }

  const activeContracts = contracts.filter(c => getContractStatus(c) === 'Đang chờ' || getContractStatus(c) === 'Quá hạn');
  const totalCapital = activeContracts.reduce((sum, c) => sum + c.amount, 0);
  const totalExpectedProfit = activeContracts.reduce((sum, c) => sum + calculateProfit(c), 0);
  const overdueCount = contracts.filter(c => getContractStatus(c) === 'Quá hạn').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30 overflow-hidden relative">
      {/* System Context Menu */}
      {systemContextMenu && (
        <div 
          className="fixed bg-slate-800/95 border border-slate-700/80 p-1.5 rounded-xl shadow-2xl flex flex-col backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 min-w-[160px] z-[9999]"
          style={{ top: Math.min(systemContextMenu.y, window.innerHeight - 50), left: Math.min(systemContextMenu.x, window.innerWidth - 180) }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => window.location.reload()} 
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:text-emerald-400 rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Tải lại App
          </button>
        </div>
      )}
      
      <BackgroundAnimation />
      
      {showWarehouse && <AssetWarehouseModal onClose={() => setShowWarehouse(false)} />}
      {showCustomers && <CustomerModal onClose={() => setShowCustomers(false)} />}
      {showAdminPanel && <AdminPanel initialTab={adminInitialTab} onClose={() => setShowAdminPanel(false)} />}


      
      <div className="relative z-10 w-full max-w-[1050px] mx-auto p-4 flex flex-col h-screen">
        {/* TopBar */}
        <header className="flex items-center justify-between py-4 mb-6 border-b border-slate-800/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/20">
              <span className="font-bold text-lg text-white">55</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Cầm Đồ 55</h1>
              <p className="text-xs text-slate-400 font-medium tracking-wide">SYSTEM V2.0 PREMIUM</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {!showForm && (
              <button 
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-sm font-bold transition-all shadow-[0_0_20px_-5px_#10b981]"
              >
                <Plus className="w-4 h-4" />
                <span>📝 Lập Hợp Đồng</span>
              </button>
            )}
            
            <div className="flex items-center gap-2 border-r border-slate-700/50 pr-4 mr-2">
              <button 
                onClick={() => {
                   if (!isBotRunning) {
                      setAdminInitialTab('ai');
                      setShowAdminPanel(true);
                   }
                }}
                className={`flex items-center justify-center w-10 h-10 border border-slate-700/50 rounded-lg transition-all group backdrop-blur-md ${isBotRunning ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-800/50 hover:bg-slate-700/80 text-slate-500'}`}
                title={isBotRunning ? "AI Bot: Đang hoạt động" : "AI Bot: Đã ngắt kết nối (Nhấn để cấu hình)"}
              >
                <Bot className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
              <button 
                onClick={() => setShowWarehouse(true)}
                className="flex items-center justify-center w-10 h-10 bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700/50 rounded-lg text-slate-300 transition-all group backdrop-blur-md"
                title="Kho Tài Sản"
              >
                <Package className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
              </button>
              <button 
                onClick={() => setShowCustomers(true)}
                className="flex items-center justify-center w-10 h-10 bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700/50 rounded-lg text-slate-300 transition-all group backdrop-blur-md"
                title="Khách Hàng"
              >
                <Users className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <div className="flex items-center gap-3 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/50 rounded-full py-1.5 pl-1.5 pr-2 transition-colors">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-sm">
                {currentUser.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col pr-2">
                <span className="text-sm font-bold leading-tight text-slate-200">{currentUser.full_name}</span>
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{currentUser.role === 'admin' ? 'Quản Trị Viên' : 'Nhân Viên'}</span>
              </div>
              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-700/50">
                {currentUser.role === 'admin' && (
                  <button onClick={() => { setAdminInitialTab('settings'); setShowAdminPanel(true); }} className="p-1.5 hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-200 transition-colors" title="Cài Đặt">
                    <Settings className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setCurrentUser(null)} className="p-1.5 hover:bg-red-500/20 rounded-full text-slate-400 hover:text-red-400 transition-colors" title="Đăng Xuất">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col gap-6 w-full min-h-0">
          {/* Dashboard Macro Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
            <div className="bg-slate-900/40 border border-blue-500/20 p-4 rounded-2xl flex items-center gap-4 shadow-lg backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Tổng Vốn Đang Đưa</div>
                <div className="text-xl font-bold text-blue-400 font-mono">{String(Math.floor(totalCapital)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫</div>
              </div>
            </div>
            
            <div className="bg-slate-900/40 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-4 shadow-lg backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Lãi Tạm Tính</div>
                <div className="text-xl font-bold text-emerald-400 font-mono">{String(Math.floor(totalExpectedProfit)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫</div>
              </div>
            </div>
            
            <div className="bg-slate-900/40 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-4 shadow-lg backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Cảnh Báo Nợ Xấu</div>
                <div className="text-xl font-bold text-rose-400 font-mono">{overdueCount} Hợp đồng</div>
              </div>
            </div>
          </div>
          {/* ContractForm is now a full-screen modal, we render it at the top level instead of in the layout flow */}
          {showForm && <ContractForm onClose={() => setShowForm(false)} />}
          
          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/40 border border-slate-800/50 rounded-2xl backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800/50 flex flex-wrap gap-4 items-center justify-between bg-slate-900/80">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                Danh Sách Hợp Đồng
              </h2>
              <div className="flex items-center gap-2 bg-slate-950/50 border border-slate-800/50 rounded-lg px-3 py-1.5 w-64 focus-within:border-emerald-500/50 transition-colors">
                <Search className="w-4 h-4 text-slate-400" />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên, SĐT, mã HĐ..." 
                  className="bg-transparent border-none outline-none text-sm w-full text-slate-200 placeholder:text-slate-600"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
              <ContractList />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
