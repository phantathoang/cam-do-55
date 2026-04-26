import { create } from 'zustand';
import { Customer, Contract, Liquidation, getCustomers, getContracts, getLiquidations, createCustomer, createContract, createLiquidation, updateLiquidation, updateContractStatus, getCustomerByPhone, updateCustomer, User, getSettings, deleteContract, updateContract, createAuditLog } from '../lib/db';
import { format } from 'date-fns';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { Command, Child } from '@tauri-apps/plugin-shell';

import CryptoJS from 'crypto-js';
import { calculateDaysActive, calculateExpectedProfit, evaluateContractStatus } from '../domain/financeLogic';

const notifiedAlerts = new Set<string>();

let botChild: Child | null = null;

export async function getMasterKey(): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const { readTextFile, writeTextFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');
  
  try {
    const appData = await appDataDir();
    if (!(await exists(appData))) {
      await mkdir(appData, { recursive: true });
    }
    const keyPath = await join(appData, '.master_key');
    if (await exists(keyPath)) {
      return await readTextFile(keyPath);
    } else {
      const newKey = crypto.randomUUID() + crypto.randomUUID();
      await writeTextFile(keyPath, newKey);
      return newKey;
    }
  } catch (e) {
    console.error("Master Key error:", e);
    // Fallback if fs fails
    return 'fallback-secure-key-if-fs-fails';
  }
}

async function pushSystemNotification(title: string, body: string): Promise<boolean> {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  // Khung giờ cho phép: 7:30-8:30, 13:30-14:30, 19:30-20:30
  const isMorning = (h === 7 && m >= 30) || (h === 8 && m <= 30);
  const isAfternoon = (h === 13 && m >= 30) || (h === 14 && m <= 30);
  const isEvening = (h === 19 && m >= 30) || (h === 20 && m <= 30);

  if (!isMorning && !isAfternoon && !isEvening) {
    return false; // Không gửi thông báo ngoài khung giờ
  }

  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }
    if (permissionGranted) {
      sendNotification({ title, body, sound: 'default' });
      return true;
    }
  } catch (e) {
    console.error("Notification error:", e);
  }
  return false;
}

interface AppState {
  customers: Customer[];
  contracts: Contract[];
  liquidations: Liquidation[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isLoading: boolean;
  fetchData: () => Promise<void>;
  handleAddContract: (payload: { phone: string; name: string; amount: number; asset: string; interestRate: number; startDate: string }) => Promise<void>;
  handlePayInterest: (contract: Contract, payDate: string) => Promise<void>;
  handleLiquidate: (contract: Contract) => Promise<void>;
  handleCheckout: (contractId: string, payDate: string) => Promise<void>;
  handleUpdateCustomer: (id: number, updates: Partial<Customer>) => Promise<void>;
  handleUpdateLiquidation: (id: number, price: number, date: string) => Promise<void>;
  handleDeleteContract: (id: string) => Promise<void>;
  handleUpdateContract: (id: string, updates: Partial<Contract>) => Promise<void>;
  handleAutoCalcAction: (contract: Contract, newAmount: number, actionType: string, diff?: number) => Promise<void>;
  showLiquidationCenter: boolean;
  setShowLiquidationCenter: (show: boolean) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  settings: Record<string, string>;
  setSettings: (settings: Record<string, string>) => void;
  fetchSettings: () => Promise<void>;
  isBotRunning: boolean;
  startBot: () => Promise<boolean>;
  stopBot: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  customers: [],
  contracts: [],
  liquidations: [],
  showLiquidationCenter: false,
  setShowLiquidationCenter: (show) => set({ showLiquidationCenter: show }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  isLoading: false,
  currentUser: JSON.parse(localStorage.getItem('currentUser') || 'null'),
  setCurrentUser: (user) => {
    set({ currentUser: user });
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
  },
  settings: {},
  setSettings: (settings) => set({ settings }),
  fetchSettings: async () => {
    const settings = await getSettings();
    set({ settings });
  },
  
  isBotRunning: false,
  startBot: async () => {
    const { settings, currentUser, isBotRunning } = get();
    if (isBotRunning || botChild !== null) return true;
    if (!currentUser || !settings.ai_telegram_token) return false;
    try {
      const mk = await getMasterKey();
      const telegramToken = CryptoJS.AES.decrypt(settings.ai_telegram_token, mk).toString(CryptoJS.enc.Utf8);
      const openaiKey = settings.ai_openai_key ? CryptoJS.AES.decrypt(settings.ai_openai_key, mk).toString(CryptoJS.enc.Utf8) : '';
      const telegramChatId = settings.ai_telegram_chat_id ? CryptoJS.AES.decrypt(settings.ai_telegram_chat_id, mk).toString(CryptoJS.enc.Utf8) : '';
      
      if (!telegramToken) return false;
      
      try {
        const pkill = Command.create('pkill', ['-f', 'telegram-agent']);
        await pkill.execute();
      } catch (e) {
        // Ignore if pkill fails (e.g. no process found or Windows)
      }
      
      const command = Command.sidecar('telegram-agent', [], {
         env: {
           TELEGRAM_BOT_TOKEN: telegramToken,
           OPENAI_API_KEY: openaiKey,
           TELEGRAM_CHAT_ID: telegramChatId
         }
      });
      command.on('close', data => {
        botChild = null;
        set({ isBotRunning: false });
        console.log(`bot finished with code ${data.code}`);
      });
      botChild = await command.spawn();
      set({ isBotRunning: true });
      return true;
    } catch (e) {
      console.error("Lỗi start bot", e);
      return false;
    }
  },
  stopBot: async () => {
    if (botChild) {
      await botChild.kill();
      botChild = null;
      await new Promise(r => setTimeout(r, 500));
    }
    set({ isBotRunning: false });
  },
  
  fetchData: async () => {
    set({ isLoading: true });
    try {
      const [customers, contracts, liquidations] = await Promise.all([getCustomers(), getContracts(), getLiquidations()]);
      
      // Khắc phục data cũ: Nếu có hợp đồng 'Thanh Lý' mà chưa có trong bảng liquidations thì tự động tạo
      const missingLiquidations = contracts.filter(c => c.status === 'Thanh Lý' && !liquidations.find(l => l.contract_id === c.id));
      for (const c of missingLiquidations) {
        try {
          await createLiquidation(c.id, c.asset || 'Tài sản', c.amount);
        } catch(e) {}
      }
      
      if (missingLiquidations.length > 0) {
        const updatedLiquidations = await getLiquidations();
        set({ customers, contracts, liquidations: updatedLiquidations, isLoading: false });
      } else {
        set({ customers, contracts, liquidations, isLoading: false });
      }

      // Check notification business rules
      const activeContracts = contracts.filter(c => c.status === 'Đang chờ' || c.status === 'Quá hạn');
      let requireRefetch = false;

      for (const c of activeContracts) {
        const d = calculateDays(c);
        const isTheChap = c.asset && !c.asset.toLowerCase().includes('tín chấp') && !c.asset.toLowerCase().includes('không có') && !c.asset.toLowerCase().includes('khong co');

        if (d >= 26 && d <= 29) {
          const key = `soon_${c.id}`;
          if (!notifiedAlerts.has(key)) {
            const sent = await pushSystemNotification('⏳ Sắp đến hạn', `K/H ${c.customer_name} đã vay ${d} ngày.`);
            if (sent) notifiedAlerts.add(key);
          }
        } else if (d === 30) {
          const key = `due_${c.id}`;
          if (!notifiedAlerts.has(key)) {
            const sent = await pushSystemNotification('🎯 Tròn đến hạn', `K/H ${c.customer_name} đã vay đúng 30 ngày.`);
            if (sent) notifiedAlerts.add(key);
          }
        } else if (d >= 39 && isTheChap) {
          if (c.status !== 'Thanh Lý') {
             await updateContractStatus(c.id, 'Thanh Lý');
             requireRefetch = true;
          }
          const key = `liquidate_${c.id}`;
          if (!notifiedAlerts.has(key)) {
            const sent = await pushSystemNotification('🔨 CHUYỂN THANH LÝ', `K/H ${c.customer_name} đã trễ hạn từ 39 ngày trở lên. HĐ được tự động chuyển sang khu vực Thanh Lý.`);
            if (sent) notifiedAlerts.add(key);
          }
        } else if (d >= 31) {
          if (c.status === 'Đang chờ') {
             await updateContractStatus(c.id, 'Quá hạn');
             requireRefetch = true;
          }
          const key = `overdue_${c.id}`;
          if (!notifiedAlerts.has(key)) {
            const sent = await pushSystemNotification('⚠️ HỢP ĐỒNG QUÁ HẠN', `K/H ${c.customer_name} đã trễ ${d - 30} ngày. HĐ được tự động chuyển sang Quá hạn.`);
            if (sent) notifiedAlerts.add(key);
          }
        }
      }

      if (requireRefetch) {
        const refetchedContracts = await getContracts();
        set({ contracts: refetchedContracts });
      }

    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },

  handleAddContract: async ({ phone, name, amount, asset, interestRate, startDate }) => {
    let customer = await getCustomerByPhone(phone);
    let customerId = customer?.id;
    if (!customerId) {
        customerId = await createCustomer(name, phone);
    }
    await createContract(customerId!, amount, asset, interestRate, startDate);
    await get().fetchData();
    pushSystemNotification('✅ Ký thành công!', `Hợp đồng mới của K/H ${name} đã được lưu.`);
  },

  handlePayInterest: async (contract, payDate) => {
    // 1. Mark complete
    await updateContractStatus(contract.id, 'Đã xong', payDate);
    // 2. Create new contract with start date = payDate
    await createContract(contract.customer_id, contract.amount, contract.asset, contract.interest_rate, payDate);
    await get().fetchData();
    pushSystemNotification('♻️ Tái ký thành công', `Hợp đồng của ${contract.customer_name} đã được đóng lãi và gia hạn.`);
  },

  handleLiquidate: async (contract) => {
    await updateContractStatus(contract.id, 'Thanh Lý');
    await createLiquidation(contract.id, contract.asset, contract.amount);
    await get().fetchData();
    pushSystemNotification('🔨 Thanh lý tài sản', `Hợp đồng của ${contract.customer_name} đã được chuyển vào kho thanh lý.`);
  },

  handleCheckout: async (contractId, payDate) => {
    await updateContractStatus(contractId, 'Đã xong', payDate);
    await get().fetchData();
  },

  handleUpdateCustomer: async (id, updates) => {
    await updateCustomer(id, updates);
    await get().fetchData();
  },

  handleUpdateLiquidation: async (id, price, date) => {
    await updateLiquidation(id, price, date);
    await get().fetchData();
  },

  handleDeleteContract: async (id) => {
    const currentUser = get().currentUser;
    await deleteContract(id);
    if (currentUser) {
       await createAuditLog(currentUser.id, 'DELETE_CONTRACT', 'contracts', id, `Deleted contract ${id}`);
    }
    await get().fetchData();
  },

  handleUpdateContract: async (id, updates) => {
    await updateContract(id, updates);
    await get().fetchData();
  },

  handleAutoCalcAction: async (contract, newAmount, actionType, diff = 0) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    await updateContractStatus(contract.id, 'Đã xong', today);
    
    if (actionType !== 'none') {
       await createContract(contract.customer_id, newAmount, contract.asset, contract.interest_rate, today);
    }
    
    if (actionType === 'debt' && diff < 0) {
       const customers = get().customers;
       const customer = customers.find(c => c.id === contract.customer_id);
       if (customer) {
         const currentDebt = customer.debt || 0;
         await updateCustomer(customer.id, { debt: currentDebt + Math.abs(diff) });
       }
    }
    
    await get().fetchData();
    pushSystemNotification('♻️ Xử lý Tái ký (AI)', `Hợp đồng của ${contract.customer_name} đã được xử lý thành công.`);
  }
}));

export function calculateDays(contract: Contract, toDate: Date = new Date()) {
  return calculateDaysActive(contract.start_date, toDate);
}

export function calculateProfit(contract: Contract, toDate: Date = new Date()) {
  const days = calculateDays(contract, toDate);
  return calculateExpectedProfit(contract.amount, contract.interest_rate, days);
}

export function getContractStatus(contract: Contract, currentDate: Date = new Date()) {
  return evaluateContractStatus(contract, currentDate);
}
