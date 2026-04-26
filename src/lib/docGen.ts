import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
/**
 * Hàm hỗ trợ tải file Word từ thư mục /templates/ pubic, 
 * render biến số và thả file docx ra cho người dùng.
 * 
 * Đại ca nhớ sửa các file docx thành dạng thẻ từ đóng mở, ví dụ: {TEN_KHACH_HANG}
 */
export async function generateContract(templateUrl: string, data: any, outputName: string) {
  try {
    const response = await fetch(templateUrl);
    if (!response.ok) {
      throw new Error(`Không tìm thấy mẫu tại đường dẫn: ${templateUrl}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    
    // Mở file zip / word
    const zip = new PizZip(arrayBuffer);
    
    // Render
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    
    doc.render(data);
    
    // Đóng gói xuất file
    const out = doc.getZip().generate({
      type: "arraybuffer",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    
    const filePath = await save({
      defaultPath: outputName,
      filters: [{ name: 'Word Document', extensions: ['docx'] }]
    });

    if (filePath) {
      await writeFile(filePath, new Uint8Array(out));
    }
  } catch (error: any) {
    console.error("Lỗi khi xuất hợp đồng DOCX:", error);
    let errorInfo = error?.message || String(error);
    if (error.properties && error.properties.errors instanceof Array) {
      const errorMessages = error.properties.errors.map((e: any) => e.properties.explanation).join("\n");
      errorInfo += "\n" + errorMessages;
    }
    throw new Error(errorInfo);
  }
}
