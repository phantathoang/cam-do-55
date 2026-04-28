import { useState } from 'react';
import { Lock, User } from 'lucide-react';
import { useAppStore } from '../../store';
import { login } from '../../lib/db';
import { toast } from 'sonner';

export default function LoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setCurrentUser } = useAppStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(username, password);
      if (user) {
        toast.success(`Xin chào, ${user.full_name}`);
        setCurrentUser(user);
      } else {
        toast.error('Tài khoản hoặc mật khẩu không đúng!');
      }
    } catch (e: any) {
      toast.error('Lỗi đăng nhập: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />
      </div>
      
      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">CamDo55</h1>
          <p className="text-slate-400 mt-2">Hệ thống quản lý tài chính chuyên nghiệp</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tên đăng nhập</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                autoFocus
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-2.5 pl-10 pr-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                placeholder="Nhập tên đăng nhập"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Mật khẩu</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-2.5 pl-10 pr-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                placeholder="Nhập mật khẩu"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-xl transition-colors mt-6 flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}
