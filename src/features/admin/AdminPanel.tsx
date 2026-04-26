import { useState, useEffect } from 'react';
import { useAppStore, getMasterKey } from '../../store';
import { X, Save, Plus, Trash2, Edit2, Shield, Settings, Users as UsersIcon, Bot, Database, Upload, Lock, Download } from 'lucide-react';
import { User, getUsers, createUser, updateUser, deleteUser, updateSetting, getDb, verifyPassword } from '../../lib/db';
import { toast } from 'sonner';
import CryptoJS from 'crypto-js';
import { invoke } from '@tauri-apps/api/core';
import { open, ask, message } from '@tauri-apps/plugin-dialog';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';

export default function AdminPanel({ onClose, initialTab = 'settings' }: { onClose: () => void, initialTab?: 'settings' | 'users' | 'ai' | 'backup' }) {
  const { currentUser, setCurrentUser, settings, fetchSettings, isBotRunning, startBot } = useAppStore();
  const [activeTab, setActiveTab] = useState<'settings' | 'users' | 'ai' | 'backup'>(initialTab);
  
  // Security Modal State
  const [authAction, setAuthAction] = useState<'export' | 'backup' | 'restore' | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Settings Form State
  const [shopName, setShopName] = useState(settings.shop_name || '');
  const [shopAddress, setShopAddress] = useState(settings.shop_address || '');
  const [shopPhone, setShopPhone] = useState(settings.shop_phone || '');

  const [telegramToken, setTelegramToken] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  
  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);

  useEffect(() => {
    loadUsers();
    
    // Decrypt keys if they exist
    const decryptKeys = async () => {
      if (currentUser) {
        const mk_real = await getMasterKey();
        if (settings.ai_telegram_token) {
          try {
            const bytes = CryptoJS.AES.decrypt(settings.ai_telegram_token, mk_real);
            setTelegramToken(bytes.toString(CryptoJS.enc.Utf8));
          } catch(e) {}
        }
        if (settings.ai_openai_key) {
          try {
            const bytes = CryptoJS.AES.decrypt(settings.ai_openai_key, mk_real);
            setOpenaiKey(bytes.toString(CryptoJS.enc.Utf8));
          } catch(e) {}
        }
        if (settings.ai_telegram_chat_id) {
          try {
            const bytes = CryptoJS.AES.decrypt(settings.ai_telegram_chat_id, mk_real);
            setTelegramChatId(bytes.toString(CryptoJS.enc.Utf8));
          } catch(e) {}
        }
      }
    };
    decryptKeys();
  }, [currentUser, settings]);

  const loadUsers = async () => {
    const list = await getUsers();
    setUsers(list);
  };

  const handleSaveSettings = async () => {
    try {
      await updateSetting('shop_name', shopName);
      await updateSetting('shop_address', shopAddress);
      await updateSetting('shop_phone', shopPhone);
      await fetchSettings();
      toast.success('Lưu cấu hình tiệm thành công!');
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleCheckUpdate = async () => {
    try {
      toast.loading('Đang kiểm tra máy chủ cập nhật...', { id: 'update-check' });
      const update = await check({
        headers: { Authorization: `Bearer ${import.meta.env.VITE_GITHUB_TOKEN}` }
      });
      toast.dismiss('update-check');
      
      if (update) {
        const yes = await ask(`Có bản cập nhật mới (v${update.version}). Bạn có muốn tải về và cài đặt ngay không?`, {
            title: 'Cập nhật Cầm Đồ 55',
            kind: 'info',
            okLabel: 'Cập nhật ngay',
            cancelLabel: 'Để sau'
        });
        
        if (yes) {
          toast.loading(`Đang tải bản cập nhật ${update.version}... Vui lòng không tắt máy.`, { duration: 10000 });
          await update.downloadAndInstall();
          toast.success('Cập nhật thành công! Đang khởi động lại...');
          await relaunch();
        }
      } else {
        toast.info('Bạn đang sử dụng phiên bản mới nhất!');
      }
    } catch (e: any) {
      toast.dismiss('update-check');
      toast.error('Lỗi kiểm tra cập nhật: ' + e);
    }
  };

  const handleSaveUser = async () => {
    try {
      if (editingUser?.id) {
        await updateUser(editingUser.id, editingUser);
        toast.success('Cập nhật nhân viên thành công!');
        if (currentUser?.id === editingUser.id) {
          const updatedList = await getUsers();
          const me = updatedList.find(u => u.id === editingUser.id);
          if (me) setCurrentUser(me);
        }
      } else {
        await createUser(editingUser as User);
        toast.success('Tạo nhân viên thành công!');
      }
      setEditingUser(null);
      loadUsers();
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleSaveAIConfig = async () => {
    if (!currentUser) return;
    try {
      const mk_real = await getMasterKey();
      const encToken = CryptoJS.AES.encrypt(telegramToken, mk_real).toString();
      const encKey = CryptoJS.AES.encrypt(openaiKey, mk_real).toString();
      const encChatId = CryptoJS.AES.encrypt(telegramChatId, mk_real).toString();
      
      await updateSetting('ai_telegram_token', encToken);
      await updateSetting('ai_openai_key', encKey);
      await updateSetting('ai_telegram_chat_id', encChatId);
      await fetchSettings();
      toast.success('Lưu cấu hình AI Agent thành công (Đã mã hoá AES-256)!');
    } catch (e: any) {
      toast.error('Lỗi mã hoá: ' + e.message);
    }
    
    // Tự động khởi động lại bot sau khi lưu
    const { stopBot } = useAppStore.getState();
    await stopBot();
    const success = await startBot();
    if (success) {
       toast.success('AI Agent đã kết nối thành công!');
    } else {
       toast.error('Không thể kích hoạt AI Bot. Vui lòng kiểm tra lại cấu hình.');
    }
  };



  const handleDeleteUser = async (id: number) => {
    if (confirm('Bạn có chắc muốn xoá nhân viên này?')) {
      await deleteUser(id);
      loadUsers();
      toast.success('Đã xoá nhân viên');
    }
  };

  const executeBackup = async () => {
    try {
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `CamDo55_Backup_${timestamp}.cd55`;
      const result = await invoke<string>('backup_database', { filename });
      toast.success('Sao lưu thành công!', {
        description: `Đã lưu tại: ${result}`,
        action: {
          label: 'Mở thư mục',
          onClick: async () => {
            const folderPath = result.substring(0, Math.max(result.lastIndexOf('/'), result.lastIndexOf('\\')));
            await invoke('open_folder', { path: folderPath });
          }
        }
      });
    } catch (e: any) {
      toast.error('Lỗi sao lưu: ' + e);
    }
  };

  const executeRestore = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Cam Do 55 Backup',
          extensions: ['cd55']
        }]
      });
      if (selected) {
        const confirmed = await ask("Phục hồi sẽ XÓA SẠCH toàn bộ dữ liệu hiện tại trên máy này và thay thế bằng dữ liệu từ bản sao lưu. Dữ liệu cũ sẽ vĩnh viễn mất đi. Bạn có chắc chắn muốn tiếp tục?", {
          title: "CẢNH BÁO NGUY HIỂM",
          kind: "warning"
        });
        
        if (confirmed) {
          await invoke('restore_database', { backupPathStr: selected });
          await message("Đã phục hồi dữ liệu thành công! Ứng dụng sẽ tự động khởi động lại.", {
            title: "Cầm Đồ 55 - Phục Hồi Thành Công",
            kind: "info"
          });
          window.location.reload();
        }
      }
    } catch (e: any) {
      toast.error('Lỗi phục hồi: ' + e);
    }
  };

  const executeExport = async () => {
    try {
      const db = await getDb();
      const contracts = await db.select<any[]>(`
        SELECT c.id, cust.name as customer_name, cust.phone, c.amount, c.asset, c.interest_rate, c.start_date, c.status
        FROM contracts c
        JOIN customers cust ON c.customer_id = cust.id
        WHERE c.deleted_at IS NULL
      `);

      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const filename = `CamDo55_Report_${timestamp}.csv`;
      
      let content = "\uFEFFMã HĐ,Khách hàng,Số điện thoại,Số tiền,Tài sản,Lãi suất,Ngày cầm,Trạng thái\n"; // UTF-8 BOM
      contracts.forEach(c => {
        content += `${c.id},"${c.customer_name}","${c.phone}",${c.amount},"${c.asset}",${c.interest_rate},${c.start_date},${c.status}\n`;
      });
      
      const result = await invoke<string>('export_report', { filename, content });
      toast.success('Xuất báo cáo thành công!', {
        description: `Đã lưu tại: ${result}`,
        action: {
          label: 'Mở thư mục',
          onClick: async () => {
            const folderPath = result.substring(0, Math.max(result.lastIndexOf('/'), result.lastIndexOf('\\')));
            await invoke('open_folder', { path: folderPath });
          }
        }
      });
    } catch (e: any) {
      toast.error('Lỗi xuất báo cáo: ' + e);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const isValid = await verifyPassword(currentUser.username, authPassword);
    
    if (!isValid) {
      setAuthError('Mật khẩu không chính xác!');
      return;
    }
    
    setAuthError('');
    const action = authAction;
    setAuthAction(null);
    setAuthPassword('');
    
    if (action === 'export') await executeExport();
    else if (action === 'backup') await executeBackup();
    else if (action === 'restore') await executeRestore();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100">Trung Tâm Quản Trị</h2>
              <p className="text-xs text-slate-400">Dành riêng cho Admin</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-slate-800 p-4 space-y-2 bg-slate-900/50">
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <Settings className="w-4 h-4" /> Cấu hình Cửa hàng
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <UsersIcon className="w-4 h-4" /> Quản lý Nhân sự
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'ai' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <Bot className="w-4 h-4" /> Cấu hình AI Agent
            </button>
            <button 
              onClick={() => setActiveTab('backup')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'backup' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <Database className="w-4 h-4" /> Sao Lưu & Phục Hồi
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
            {activeTab === 'settings' && (
              <div className="max-w-xl animate-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-400" /> Thông tin xuất Hợp Đồng
                </h3>
                
                <div className="space-y-5 max-w-lg">
                  <div className="space-y-1 group">
                    <label className="block text-xs font-medium text-slate-400 group-focus-within:text-purple-400 transition-colors mb-1">Tên Tiệm Cầm Đồ</label>
                    <input 
                      type="text" 
                      value={shopName}
                      onChange={e => setShopName(e.target.value)}
                      className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition-colors text-slate-200"
                      placeholder="VD: CẦM ĐỒ 55"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <label className="block text-xs font-medium text-slate-400 group-focus-within:text-purple-400 transition-colors mb-1">Địa chỉ</label>
                    <input 
                      type="text" 
                      value={shopAddress}
                      onChange={e => setShopAddress(e.target.value)}
                      className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition-colors text-slate-200"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <label className="block text-xs font-medium text-slate-400 group-focus-within:text-purple-400 transition-colors mb-1">Số điện thoại</label>
                    <input 
                      type="text" 
                      value={shopPhone}
                      onChange={e => setShopPhone(e.target.value)}
                      className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition-colors text-slate-200"
                    />
                  </div>

                  <div className="pt-4 flex items-center justify-between border-b border-slate-800 pb-6">
                    <button 
                      onClick={handleSaveSettings}
                      className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_-5px_#9333ea] flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Lưu Cấu Hình
                    </button>
                  </div>

                  <div className="pt-2">
                    <h4 className="text-sm font-bold text-slate-300 mb-2">Cập Nhật Phần Mềm</h4>
                    <p className="text-xs text-slate-500 mb-4">Phiên bản hiện tại: <strong className="text-slate-300">{appVersion || '...'}</strong></p>
                    <button 
                      onClick={handleCheckUpdate}
                      className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Kiểm tra Cập nhật
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <UsersIcon className="w-5 h-5 text-purple-400" /> Danh sách nhân viên
                  </h3>
                  <button 
                    onClick={() => setEditingUser({ role: 'user' })}
                    className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Thêm Mới
                  </button>
                </div>

                {editingUser ? (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-6">
                    <h4 className="font-bold text-slate-200 mb-4">{editingUser.id ? 'Sửa Nhân Viên' : 'Thêm Mới Nhân Viên'}</h4>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-1 group">
                        <label className="block text-xs font-medium text-slate-400 group-focus-within:text-purple-400 transition-colors mb-1">Tên đăng nhập</label>
                        <input type="text" value={editingUser.username || ''} onChange={e => setEditingUser({...editingUser, username: e.target.value})} className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition-colors text-slate-200" />
                      </div>
                      <div className="space-y-1 group">
                        <label className="block text-xs font-medium text-slate-400 group-focus-within:text-purple-400 transition-colors mb-1">Mật khẩu {editingUser.id && '(Bỏ trống nếu không đổi)'}</label>
                        <input type="password" placeholder="***" value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})} className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition-colors text-slate-200" />
                      </div>
                      <div className="space-y-1 group">
                        <label className="block text-xs font-medium text-slate-400 group-focus-within:text-purple-400 transition-colors mb-1">Họ và tên (In trên HĐ)</label>
                        <input type="text" value={editingUser.full_name || ''} onChange={e => setEditingUser({...editingUser, full_name: e.target.value})} className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition-colors text-slate-200" />
                      </div>
                      <div className="space-y-1 group">
                        <label className="block text-xs font-medium text-slate-400 group-focus-within:text-purple-400 transition-colors mb-1">Vai trò</label>
                        <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition-colors text-slate-200">
                          <option value="user">Nhân viên (User)</option>
                          <option value="admin">Quản lý (Admin)</option>
                        </select>
                      </div>
                      <div className="col-span-2 space-y-1 group">
                        <label className="block text-xs font-medium text-slate-400 group-focus-within:text-purple-400 transition-colors mb-1">Số CCCD</label>
                        <input type="text" value={editingUser.cccd || ''} onChange={e => setEditingUser({...editingUser, cccd: e.target.value})} className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition-colors text-slate-200" />
                      </div>
                      <div className="col-span-2 space-y-1 group">
                        <label className="block text-xs font-medium text-slate-400 group-focus-within:text-purple-400 transition-colors mb-1">Địa chỉ</label>
                        <input type="text" value={editingUser.address || ''} onChange={e => setEditingUser({...editingUser, address: e.target.value})} className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition-colors text-slate-200" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/50 mt-2">
                      <button onClick={() => setEditingUser(null)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 transition-colors">Huỷ</button>
                      <button onClick={handleSaveUser} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-[0_0_20px_-5px_#9333ea] transition-all"><Save className="w-4 h-4"/> Lưu Thông Tin</button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-800/50 text-slate-400">
                        <tr>
                          <th className="px-4 py-3 font-medium">Tài khoản</th>
                          <th className="px-4 py-3 font-medium">Họ Tên</th>
                          <th className="px-4 py-3 font-medium">Vai trò</th>
                          <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3 text-slate-200 font-medium">{u.username}</td>
                            <td className="px-4 py-3 text-slate-300">{u.full_name}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/20' : 'bg-slate-800 text-slate-400'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 flex justify-end gap-2">
                              <button onClick={() => setEditingUser(u)} className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                              {currentUser?.id !== u.id && (
                                <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="max-w-xl animate-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-emerald-400" /> Cấu Hình AI Agent
                </h3>
                
                <div className="space-y-5 max-w-lg">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-sm text-emerald-200 mb-6">
                    <p className="font-bold mb-1">Mã Hoá AES-256 Kích Hoạt</p>
                    <p className="text-emerald-400/80 text-xs">API Key của bạn sẽ được mã hoá bằng mật khẩu Admin trước khi lưu vào Database. Mức độ bảo mật tuyệt đối.</p>
                  </div>

                  <div className="space-y-1 group">
                    <label className="block text-xs font-medium text-slate-400 group-focus-within:text-emerald-400 transition-colors mb-1">Telegram Bot Token</label>
                    <input 
                      type="password" 
                      value={telegramToken}
                      onChange={e => setTelegramToken(e.target.value)}
                      className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none transition-colors text-slate-200"
                      placeholder="123456789:AAHx..."
                    />
                  </div>
                  <div className="space-y-1 group">
                    <label className="block text-xs font-medium text-slate-400 group-focus-within:text-emerald-400 transition-colors mb-1">OpenAI API Key</label>
                    <input 
                      type="password" 
                      value={openaiKey}
                      onChange={e => setOpenaiKey(e.target.value)}
                      className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none transition-colors text-slate-200"
                      placeholder="sk-..."
                    />
                  </div>
                  <div className="space-y-1 group">
                    <label className="block text-xs font-medium text-slate-400 group-focus-within:text-emerald-400 transition-colors mb-1">Telegram Admin Chat ID</label>
                    <input 
                      type="password" 
                      value={telegramChatId}
                      onChange={e => setTelegramChatId(e.target.value)}
                      className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none transition-colors text-slate-200"
                      placeholder="Ví dụ: 8439569889"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Chỉ định ID của tài khoản Telegram được phép chat với Bot. Trống sẽ dùng mặc định.</p>
                  </div>

                  <div className="pt-4 flex items-center gap-3">
                    <button 
                      onClick={handleSaveAIConfig}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_-5px_#10b981] flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Lưu Cấu Hình & Kết Nối Bot
                    </button>
                  </div>
                  
                  {isBotRunning && (
                    <div className="mt-4 flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      Bot đang chạy ngầm...
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'backup' && (
              <div className="max-w-3xl animate-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" /> Hệ thống Lưu trữ & Báo cáo
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* CƠ CHẾ 1: EXPORT REPORT */}
                  <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl flex flex-col items-start gap-4 hover:border-slate-600 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
                      <Save className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-200">Xuất Báo Cáo (CSV)</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Chỉ lấy dữ liệu hợp đồng hiện tại xuất ra file CSV để mở trong Excel, tính toán hoặc gửi kế toán.
                      </p>
                    </div>
                    <div className="mt-auto pt-4 w-full border-t border-slate-700/50">
                      <button 
                        onClick={() => setAuthAction('export')}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-2 rounded-xl transition-colors text-sm"
                      >
                        Xuất File Báo Cáo
                      </button>
                    </div>
                  </div>

                  {/* CƠ CHẾ 2: BACKUP & RESTORE */}
                  <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl flex flex-col items-start gap-4 hover:border-slate-600 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <Database className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-200">Sao Lưu Hệ Thống</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Tạo bản sao lưu toàn vẹn 100% của database (Wipe & Restore) để chuyển máy hoặc dự phòng rủi ro.
                      </p>
                    </div>
                    <div className="mt-auto pt-4 w-full border-t border-slate-700/50 flex gap-2">
                      <button 
                        onClick={() => setAuthAction('backup')}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-xl transition-colors text-sm"
                      >
                        Sao Lưu Ngay
                      </button>
                      <button 
                        onClick={() => setAuthAction('restore')}
                        className="flex-1 bg-slate-700 hover:bg-rose-600 hover:text-white text-slate-200 font-medium py-2 rounded-xl transition-colors text-sm border border-slate-600 hover:border-rose-500 flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" /> Phục Hồi
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-8 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <h5 className="text-sm font-bold text-amber-500 mb-2">Quy tắc Toàn Vẹn Dữ Liệu:</h5>
                  <ul className="text-xs text-amber-200/70 space-y-2 list-disc pl-4">
                    <li>File Báo Cáo (.csv) <strong>KHÔNG THỂ</strong> import ngược lại hệ thống vì có thể gây đứt gãy liên kết (Foreign Keys).</li>
                    <li>Để chuyển máy mới, hãy bấm <strong>Sao Lưu Ngay</strong> để lấy file `.cd55`, mang qua máy mới và báo kỹ thuật viên phục hồi (Wipe & Restore). Mức toàn vẹn là 100%.</li>
                    <li>Thư mục chứa file tự động tại Desktop của bạn: <button onClick={async () => {
                      try {
                        const { desktopDir, join } = await import('@tauri-apps/api/path');
                        const desktopPath = await desktopDir();
                        const targetPath = await join(desktopPath, 'cam-do-55');
                        await invoke('open_folder', { path: targetPath });
                      } catch (e) {
                        toast.error('Không thể mở thư mục');
                      }
                    }} className="bg-black/30 hover:bg-black/50 px-2 py-0.5 rounded text-amber-400 font-mono transition-colors active:scale-95 cursor-pointer inline-flex items-center gap-1 border border-amber-500/20" title="Nhấn để mở thư mục">Desktop/cam-do-55/</button></li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {authAction && (
        <div className="fixed inset-0 z-[60] bg-slate-950/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100">Xác thực bảo mật</h3>
                <p className="text-xs text-slate-400">Yêu cầu quyền Admin</p>
              </div>
            </div>
            
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-400 mb-1">Nhập mật khẩu của bạn để tiếp tục:</label>
                <input 
                  type="password" 
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-rose-500 outline-none transition-colors text-slate-200"
                  placeholder="••••••••"
                  autoFocus
                />
                {authError && <p className="text-xs text-rose-500 mt-1">{authError}</p>}
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => { setAuthAction(null); setAuthPassword(''); setAuthError(''); }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 rounded-xl transition-colors text-sm"
                >
                  Huỷ bỏ
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
                >
                  Xác nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
