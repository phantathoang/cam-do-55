import { Contract } from '../../lib/db';
import { format, parseISO } from 'date-fns';
import { Printer, X } from 'lucide-react';
import { HopDongVayTien, HopDongCamCo } from './ContractTemplates';

import { generateContract } from '../../lib/docGen';
import { toast } from 'sonner';
import { useAppStore } from '../../store';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

interface Props {
  contract: Contract;
  onClose: () => void;
}

// Hàm đọc số tiền thành chữ (rất cơ bản)
function numberToWords(num: number): string {
  if (num === 0) return 'không đồng';
  // Implement a fast, simple formatting or just return ".............................. đồng" temporarily
  // We can write a simple converter for millions/billions:
  if (num >= 1000000 && num % 1000000 === 0) {
    return `${num / 1000000} triệu đồng chẵn`;
  }
  return '................................................... đồng';
}

function formatCurrency(num: number) {
  return String(Math.floor(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function ContractPrintView({ contract, onClose }: Props) {
  const isUnsecured = !contract.asset || contract.asset === 'Tín chấp' || contract.asset?.toLowerCase().includes('không có') || contract.asset?.toLowerCase().includes('khong co');
  let isRealEstate = false;
  let parsedAsset: any[] = [];
  try {
    parsedAsset = JSON.parse(contract.asset || '[]');
    if (Array.isArray(parsedAsset)) {
      isRealEstate = parsedAsset.some(a => a.type === 'Bất Động Sản');
    }
  } catch(e) {}

  const startDate = parseISO(contract.start_date);
  const day = format(startDate, 'dd');
  const month = format(startDate, 'MM');
  const year = format(startDate, 'yyyy');

  const { settings, currentUser } = useAppStore();

  const shopData = {
    name: settings.shop_name || 'CẦM ĐỒ 55',
    address: settings.shop_address || '.......................................................................',
    phone: settings.shop_phone || '....................',
    owner: currentUser?.full_name || '.........................................',
    owner_cccd: currentUser?.cccd || '....................',
    owner_cccd_date: currentUser?.cccd_date || '....................',
    owner_cccd_place: currentUser?.cccd_place || '....................',
    owner_address: currentUser?.address || '.......................................................................'
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById('printable-contract');
    if (!element) return;
    
    toast.loading('Đang khởi tạo file PDF...', { id: 'pdf-gen' });
    
    const opt: any = {
      margin:       [0, 0], // set margin to 0 because we already have padding inside the html wrapper
      filename:     `HopDong-${contract.id}.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, windowWidth: 1000 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).outputPdf('arraybuffer').then(async (pdfBuffer: ArrayBuffer) => {
      try {
        const filePath = await save({
          defaultPath: opt.filename,
          filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });
        
        if (filePath) {
          await writeFile(filePath, new Uint8Array(pdfBuffer));
          toast.success('Lưu PDF thành công!', { id: 'pdf-gen' });
        } else {
          toast.dismiss('pdf-gen');
        }
      } catch (err: any) {
        let msg = err?.message || String(err);
        toast.error('Lỗi lưu file PDF: ' + msg, { id: 'pdf-gen' });
        console.error("PDF Save Error:", err);
      }
    }).catch((err: any) => {
      let msg = err?.message || String(err);
      toast.error('Lỗi khi khởi tạo PDF: ' + msg, { id: 'pdf-gen' });
      console.error(err);
    });
  };

  const handleDownloadDocx = async (type: 'Vay' | 'TaiSan') => {
    try {
      const data = {
        MA_HOP_DONG: contract.id,
        NGAY: day,
        THANG: month,
        NAM: year,
        TEN_KHACH_HANG: contract.customer_name,
        SDT_KHACH_HANG: contract.customer_phone,
        SO_TIEN_VAY: formatCurrency(contract.amount),
        SO_TIEN_CHU: numberToWords(contract.amount),
        LAI_SUAT: contract.interest_rate,
        TEN_CUA_HANG: shopData.name,
        DIA_CHI_CUA_HANG: shopData.address,
        SDT_CUA_HANG: shopData.phone,
        DAI_DIEN: shopData.owner,
        CCCD_DAI_DIEN: shopData.owner_cccd,
        NGAY_CAP_DAI_DIEN: shopData.owner_cccd_date,
        NOI_CAP_DAI_DIEN: shopData.owner_cccd_place,
        DIA_CHI_DAI_DIEN: shopData.owner_address
      };

      if (type === 'Vay') {
        toast.promise(generateContract('/templates/hop_dong_vay_tien.docx', data, `Hop_dong_vay_${contract.id}.docx`), {
          loading: 'Đang tạo Hợp đồng vay...',
          success: 'Tạo thành công!',
          error: (e) => `Lỗi sinh HĐ: ${e.message}`,
        });
      } else {
        const fileUrl = isRealEstate ? '/templates/hop_dong_the_chap_bds.docx' : (isUnsecured ? null : '/templates/hop_dong_cam_co_xe.docx');
        if (!fileUrl) return toast.info("Không có tài sản nào cần lập HĐ cầm cố!");
        
        toast.promise(generateContract(fileUrl, data, `Hop_dong_bao_dam_${contract.id}.docx`), {
          loading: 'Đang tạo Hợp đồng tài sản...',
          success: 'Tạo thành công!',
          error: (e) => `Lỗi sinh HĐ: ${e.message}`,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-900/90 flex flex-col items-center p-4 sm:p-8 animate-in fade-in duration-200 overflow-y-auto custom-scrollbar" onClick={onClose}>
      
      <div className="flex flex-col gap-2 mb-4 print:hidden w-full max-w-[210mm] justify-end shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex gap-4 justify-between items-center w-full">
          <div className="text-white text-sm bg-slate-800/70 py-1.5 px-3 rounded-lg border border-slate-700/50 flex-1 me-4 whitespace-nowrap overflow-hidden text-ellipsis shadow-inner">
            <span className="text-emerald-400 font-bold mr-2">👁️ CHẾ ĐỘ XEM TRƯỚC (PREVIEW)</span>
            Dữ liệu đã được nạp tự động. Vui lòng kiểm tra trước khi xuất.
          </div>
          
          <div className="flex gap-2 shrink-0">
            <button onClick={() => handleDownloadDocx('Vay')} className="px-3 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg flex items-center gap-2 font-medium hover:bg-blue-600/40 transition-colors text-sm shadow-sm hover:shadow-blue-500/10">
              Tải mẫu Word
            </button>
            <button onClick={handlePrint} className="px-5 py-2 bg-emerald-500 text-slate-950 rounded-lg flex items-center gap-2 font-bold shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)] hover:bg-emerald-400 transition-colors">
              <Printer className="w-5 h-5 drop-shadow-sm" /> LƯU PDF / IN
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-white rounded-lg flex items-center gap-2 font-medium hover:bg-red-500 hover:text-white transition-colors text-sm shadow-sm">
              <X className="w-4 h-4" /> Đóng
            </button>
          </div>
        </div>
      </div>

      {/* Printable Paper A4 wrapper */}
      <div 
        id="printable-contract"
        onClick={e => e.stopPropagation()}
        className="bg-white w-full max-w-[210mm] min-h-[297mm] text-black shadow-2xl pt-[20mm] pb-[20mm] pl-[30mm] pr-[20mm] shrink-0 mb-8 print:shadow-none print:p-0 print:overflow-visible print:absolute print:inset-0 text-justify"
        style={{ color: '#000', fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', lineHeight: '1.25' }}
      >
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-container, .print-container * { visibility: visible; }
            .print-container { position: absolute; left: 0; top: 0; right: 0; }
          }
        `}</style>
        
        <div className="print-container flex flex-col items-center">
          <div className="w-full">
            <HopDongVayTien contract={contract} day={day} month={month} year={year} shopData={shopData} />
          </div>
          
          {!isUnsecured && (
            <div className="w-full break-before-page mt-16 print:mt-0 print:break-before-page" style={{ pageBreakBefore: 'always' }}>
               <HopDongCamCo contract={contract} day={day} month={month} year={year} shopData={shopData} parsedAsset={parsedAsset} isRealEstate={isRealEstate} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
