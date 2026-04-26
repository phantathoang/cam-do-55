function formatCurrency(num: number) {
  return String(Math.floor(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function numberToWords(num: number): string {
  if (num === 0) return 'không đồng .........................................................................................................................................';
  if (num >= 1000000 && num % 1000000 === 0) {
    return `${num / 1000000} triệu đồng chẵn ....................................................................................................................`;
  }
  return '........................................................................................................................................................................ đồng';
}

const pStyle = { margin: '6px 0', textAlign: 'justify' as const, pageBreakInside: 'avoid' as const };
const liStyle = { marginBottom: '4px', textAlign: 'left' as const, pageBreakInside: 'avoid' as const };
const flexLi = { ...liStyle, display: 'flex', alignItems: 'flex-end', whiteSpace: 'nowrap' as const, pageBreakInside: 'avoid' as const };
const DottedFill = () => <span style={{ flexGrow: 1, borderBottom: '1.5px dotted #000', margin: '0 8px', transform: 'translateY(-1px)' }}></span>;

export function HopDongVayTien({ contract, day, month, year, shopData }: any) {
  return (
    <div style={{ fontSize: 'inherit', lineHeight: 'inherit', color: '#000' }}>
      <div style={{ textAlign: 'center', lineHeight: '1.2' }}>
        <h3 style={{ margin: 0, fontSize: '15pt', fontWeight: 'bold' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3>
        <h4 style={{ margin: '4px 0', fontSize: '14pt', fontWeight: 'bold' }}>Độc lập – Tự do – Hạnh phúc</h4>
        <p style={{ margin: 0 }}>-------------------------</p>
        <br/>
        <h2 style={{ margin: '15px 0 10px', fontSize: '14pt', fontWeight: 'bold' }}>HỢP ĐỒNG VAY TIỀN</h2>
      </div>
      
      <p style={{ textAlign: 'center', margin: '5px 0', fontStyle: 'italic' }}>Số: {contract.id}/HĐVT</p>
      <p style={{ margin: '25px 0 20px', fontStyle: 'italic', textAlign: 'center' }}>Hôm nay, ngày {day} tháng {month} năm {year}, tại {shopData.name}, chúng tôi gồm:</p>
      
      <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '15px 0 8px' }}>BÊN CHO VAY (BÊN A):</h3>
      <ul style={{ listStyle: 'none', padding: '0 0 0 10px', margin: 0 }}>
        <li style={liStyle}>Đại diện cửa hàng cầm đồ: <span style={{textTransform: 'uppercase', marginLeft: '6px'}}>{shopData.name}</span></li>
        <li style={liStyle}>Người đại diện ký: {shopData.owner !== '.........................................' ? <span style={{marginLeft: '6px', textTransform: 'uppercase'}}>{shopData.owner}</span> : <DottedFill/>}</li>
        <li style={flexLi}>CMND/CCCD số: {shopData.owner_cccd !== '....................' ? <span style={{marginLeft: '6px', marginRight: '15px'}}>{shopData.owner_cccd}</span> : <DottedFill/>} Ngày cấp: {shopData.owner_cccd_date !== '....................' ? <span style={{marginLeft: '6px', marginRight: '15px'}}>{shopData.owner_cccd_date}</span> : <DottedFill/>} Nơi cấp: {shopData.owner_cccd_place !== '....................' ? <span style={{marginLeft: '6px'}}>{shopData.owner_cccd_place}</span> : <DottedFill/>}</li>
        <li style={liStyle}>Địa chỉ: {shopData.owner_address}</li>
        <li style={liStyle}>Số điện thoại: {shopData.phone}</li>
      </ul>

      <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '20px 0 8px' }}>BÊN VAY (BÊN B):</h3>
      <ul style={{ listStyle: 'none', padding: '0 0 0 10px', margin: 0 }}>
        <li style={liStyle}>Họ và tên: <span style={{textTransform: 'uppercase', marginLeft: '6px'}}>{contract.customer_name}</span></li>
        <li style={flexLi}>CMND/CCCD số: <DottedFill/> Ngày cấp: <DottedFill/> Nơi cấp: <DottedFill/></li>
        <li style={flexLi}>Địa chỉ thường trú: <DottedFill/></li>
        <li style={flexLi}>Địa chỉ hiện tại: <DottedFill/></li>
        <li style={liStyle}>Số điện thoại liên hệ: <span style={{marginLeft: '6px'}}>{contract.customer_phone}</span></li>
      </ul>

      <p style={pStyle}>Hai bên tự nguyện ký kết Hợp đồng vay tiền này tuân thủ theo quy định pháp luật Việt Nam.</p>

      <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '20px 0 5px' }}>ĐIỀU 1. SỐ TIỀN VAY – MỤC ĐÍCH – THỜI HẠN</h3>
      <p style={{ margin: '5px 0', fontWeight: 'bold' }}>1.1. Số tiền vay:</p>
      <p style={{ margin: '5px 0', paddingLeft: '20px' }}>Bên A cho Bên B vay số tiền: <b>{formatCurrency(contract.amount)}</b> đồng.</p>
      <p style={{ margin: '5px 0', fontStyle: 'italic', paddingLeft: '20px' }}>(Bằng chữ: {numberToWords(contract.amount)})</p>
      
      <p style={flexLi}><span style={{fontWeight: 'bold', marginRight: '6px'}}>1.2. Mục đích vay:</span><DottedFill/></p>
      <p style={{ margin: '5px 0', paddingLeft: '20px' }}>Bên B vay tiền để sử dụng vào mục đích cụ thể, hợp pháp. Bên B cam kết đây là mục đích thực tế, không giả tạo, không che giấu mục đích bất hợp pháp.</p>
      
      <p style={{ margin: '5px 0', fontWeight: 'bold' }}>1.3. Thời hạn vay:</p>
      <ul style={{ listStyle: 'none', padding: '0 0 0 20px', margin: '5px 0' }}>
        <li style={flexLi}>Thời hạn vay: <DottedFill/> tháng / ngày.</li>
        <li style={liStyle}>Từ ngày {day}/{month}/{year} đến hết ngày ......./......./20.......</li>
      </ul>
      
      <p style={{ margin: '5px 0', fontWeight: 'bold' }}>1.4. Giao nhận tiền:</p>
      <ul style={{ listStyle: 'none', padding: '0 0 0 20px', margin: '5px 0' }}>
        <li style={flexLi}>Địa điểm: <DottedFill/></li>
        <li style={liStyle}>Hình thức: [ &nbsp;x&nbsp; ] Tiền mặt &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp;&nbsp;&nbsp; ] Chuyển khoản.</li>
      </ul>
      <p style={{ margin: '5px 0', paddingLeft: '20px' }}>Bên B xác nhận đã nhận đủ tiền ngay sau khi ký Hợp đồng và/hoặc theo chứng từ giao nhận kèm theo.</p>

      <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '20px 0 5px' }}>ĐIỀU 2. LÃI SUẤT – THANH TOÁN</h3>
      <p style={pStyle}>2.1. Lãi suất: Để hoàn thành việc ký kết hợp đồng, hai bên thống nhất mức lãi suất cho vay không vượt quá quy định pháp luật về cho vay lãi nặng tại thời điểm giao kết.</p>
      <p style={pStyle}>Mức lãi suất Bên B đề xuất và tự nguyện tuân thủ là: <b>{contract.interest_rate} đ/1 triệu/ngày</b>, tính trên dư nợ gốc thực tế.</p>
      <p style={flexLi}>2.2. Thanh toán: Bên B thanh toán lãi theo định kỳ vào ngày <span style={{width: '60px', borderBottom: '2px dotted #000'}}></span> hàng tháng/quý.</p>

      <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '20px 0 5px' }}>ĐIỀU 3. LÃI CHẬM TRẢ – PHẠT VI PHẠM</h3>
      <p style={pStyle}>3.1. Khi Bên B không trả đúng hạn, phần tiền chậm trả chịu lãi chậm trả không vượt quá mức pháp luật cho phép.</p>
      <p style={pStyle}>3.2. Ngoài lãi chậm trả, Bên B chịu trách nhiệm thanh toán mọi chi phí hợp lý phát sinh nhằm bảo vệ lợi ích hợp pháp của Bên A.</p>
      
      <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '20px 0 5px' }}>ĐIỀU 4. CAM KẾT TRUNG THỰC – SỬ DỤNG VỐN</h3>
      <p style={pStyle}>4.1. Bên B cam kết cung cấp trung thực mọi thông tin cá nhân và tài chính. Nếu có hành vi che giấu, lẩn tránh trách nhiệm, Bên A có quyền đơn phương chấm dứt hợp đồng và yêu cầu cơ quan pháp luật can thiệp.</p>
      
      <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '20px 0 5px' }}>ĐIỀU 5. TÀI SẢN BẢO ĐẢM (NẾU CÓ)</h3>
      <p style={pStyle}>5.1. Khi phát sinh tài sản bảo đảm, chi tiết tài sản và hình thức bảo đảm được lập thành Hợp đồng bảo đảm riêng, đính kèm và là một phần không thể tách rời của Hợp đồng vay tiền này.</p>
      
      <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '20px 0 5px' }}>ĐIỀU 6. VI PHẠM NGHĨA VỤ VÀ ĐIỀU KHOẢN CHUNG</h3>
      <p style={pStyle}>6.1. Khi quá hạn theo thoả thuận mà Bên B chưa thanh toán đứt điểm, Bên B tự nguyện đồng ý để Bên A khởi kiện hoặc xử lý toàn bộ tài sản bảo đảm (nếu có) để cấn trừ nghĩa vụ nợ, mà không có bất kỳ tranh chấp khiếu nại nào.</p>
      <p style={pStyle}>Hai bên cùng ký tên (điểm chỉ) xác nhận để làm bằng chứng pháp lý rõ ràng nhất.</p>

      <table style={{ width: '100%', marginTop: '50px', textAlign: 'center', pageBreakInside: 'avoid' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%' }}>
              <b>BÊN CHO VAY (BÊN A)</b><br/>
              <i>(Ký, điểm chỉ và ghi rõ họ tên)</i><br/><br/><br/><br/><br/><br/>
              <b>{shopData.name}</b>
            </td>
            <td style={{ width: '50%' }}>
              <b>BÊN VAY (BÊN B)</b><br/>
              <i>(Ký, điểm chỉ và ghi rõ họ tên)</i><br/><br/><br/><br/><br/><br/>
              <b style={{textTransform: 'uppercase'}}>{contract.customer_name}</b>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function HopDongCamCo({ contract, day, month, year, shopData, parsedAsset, isRealEstate }: any) {
  const isCarMode = parsedAsset.some((a: any) => a.type === 'Xe Ô Tô' || a.type === 'Xe Máy');
  const typeLabel = isRealEstate ? 'THẾ CHẤP BẤT ĐỘNG SẢN' : (isCarMode ? 'CẦM CỐ XE' : 'CẦM CỐ TÀI SẢN');
  const typeShort = isRealEstate ? 'TC-BĐS' : (isCarMode ? 'CCX' : 'CCTS');
  const roleA = isRealEstate ? 'NHẬN THẾ CHẤP' : 'NHẬN CẦM CỐ';
  const roleB = isRealEstate ? 'THẾ CHẤP' : 'CẦM CỐ';

  return (
    <div style={{ fontSize: 'inherit', lineHeight: 'inherit', color: '#000' }}>
      <div style={{ textAlign: 'center', lineHeight: '1.2' }}>
        <h3 style={{ margin: 0, fontSize: '15pt', fontWeight: 'bold' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3>
        <h4 style={{ margin: '4px 0', fontSize: '14pt', fontWeight: 'bold' }}>Độc lập – Tự do – Hạnh phúc</h4>
        <p style={{ margin: 0 }}>-------------------------</p>
        <br/>
        <h2 style={{ margin: '15px 0 10px', fontSize: '14pt', fontWeight: 'bold' }}>HỢP ĐỒNG {typeLabel}</h2>
      </div>
      
      <p style={{ textAlign: 'center', margin: '5px 0', fontStyle: 'italic' }}>Số: {contract.id}/{typeShort}</p>
      <p style={{ textAlign: 'center', margin: '5px 0', fontStyle: 'italic' }}>(Phụ lục bảo đảm cho Hợp đồng vay tiền số {contract.id}/HĐVT ngày {day}/{month}/{year})</p>
      <p style={{ margin: '25px 0 20px', fontStyle: 'italic', textAlign: 'center' }}>Hôm nay, ngày {day} tháng {month} năm {year}, tại {shopData.name}, chúng tôi gồm:</p>
      
      <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '15px 0 8px' }}>BÊN {roleA} (BÊN A):</h3>
      <ul style={{ listStyle: 'none', padding: '0 0 0 10px', margin: 0 }}>
        <li style={liStyle}>Đại diện cửa hàng cầm đồ: <span style={{textTransform: 'uppercase', marginLeft: '6px'}}>{shopData.name}</span></li>
        <li style={liStyle}>Người đại diện ký: {shopData.owner !== '.........................................' ? <span style={{marginLeft: '6px', textTransform: 'uppercase'}}>{shopData.owner}</span> : <DottedFill/>}</li>
        <li style={flexLi}>CMND/CCCD số: {shopData.owner_cccd !== '....................' ? <span style={{marginLeft: '6px', marginRight: '15px'}}>{shopData.owner_cccd}</span> : <DottedFill/>} Ngày cấp: {shopData.owner_cccd_date !== '....................' ? <span style={{marginLeft: '6px', marginRight: '15px'}}>{shopData.owner_cccd_date}</span> : <DottedFill/>} Nơi cấp: {shopData.owner_cccd_place !== '....................' ? <span style={{marginLeft: '6px'}}>{shopData.owner_cccd_place}</span> : <DottedFill/>}</li>
        <li style={liStyle}>Địa chỉ: {shopData.owner_address}</li>
        <li style={liStyle}>Số điện thoại liên hệ: {shopData.phone}</li>
      </ul>

      <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '20px 0 8px' }}>BÊN {roleB} (BÊN B):</h3>
      <ul style={{ listStyle: 'none', padding: '0 0 0 10px', margin: 0 }}>
        <li style={liStyle}>Họ và tên: <span style={{textTransform: 'uppercase', marginLeft: '6px'}}>{contract.customer_name}</span></li>
        <li style={flexLi}>CMND/CCCD số: <DottedFill/> Ngày cấp: <DottedFill/> Nơi cấp: <DottedFill/></li>
        <li style={flexLi}>Địa chỉ hiện tại: <DottedFill/></li>
        <li style={liStyle}>Điện thoại di động: <span style={{marginLeft: '6px'}}>{contract.customer_phone}</span></li>
      </ul>

      <p style={{ margin: '25px 0 15px' }}>Hai bên thống nhất ký kết lập Hợp đồng {roleA.toLowerCase()} tài sản này để bảo đảm cho việc thực hiện nghĩa vụ vay mượn với các điều khoản pháp lý đính kèm sau đây:</p>

      <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '20px 0 5px' }}>ĐIỀU 1. NGHĨA VỤ ĐƯỢC BẢO ĐẢM</h3>
      <p style={pStyle}>1.1. Mục đích của Hợp đồng này là để bảo đảm bằng tài sản cho khoản nghĩa vụ nợ gốc, tiền lãi và chi phí vi phạm mà Bên B có trách nhiệm thanh toán cho Bên A.</p>
      <p style={pStyle}>1.2. Giá trị nghĩa vụ tại thời điểm ký kết Hợp đồng vay là khoản tiền gốc: <b>{formatCurrency(contract.amount)} đồng</b>.</p>

      <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '20px 0 5px' }}>ĐIỀU 2. LƯỢT KÊ CHI TIẾT TÀI SẢN {roleB}</h3>
      <ul style={{ listStyle: 'none', padding: '0 0 0 20px', margin: '10px 0' }}>
        {parsedAsset.length > 0 ? parsedAsset.map((a: any, i: number) => (
          <li key={i} style={liStyle}><b>Tài sản {i + 1} ({a.type})</b>: {a.description}</li>
        )) : (
          <li style={flexLi}>Chủng loại và mô tả chứng thư tài sản: <DottedFill/></li>
        )}
      </ul>
      <p style={{...pStyle, marginBottom: 0}}>Hồ sơ, giấy tờ bản gốc liên quan đính kèm (Ví dụ: Giấy biên nhận, Cà vẹt xe, Sổ hồng...):</p>
      <p style={{...flexLi, height: '30px'}}><DottedFill/></p>
      <p style={flexLi}>Tình trạng tài sản tại lúc giao nhận: <DottedFill/></p>
      <p style={pStyle}>Hai bên xác nhận Bên B đã bàn giao trực tiếp toàn bộ tài sản cùng chứng thư hợp lệ sang cho Bên A quản lý tính từ thời điểm đặt bút ký.</p>

      <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '20px 0 5px' }}>ĐIỀU 3. CAM KẾT PHÁP LÝ VỀ NGUỒN GỐC TÀI SẢN</h3>
      <p style={pStyle}>3.1. Bên B cam đoan chịu trách nhiệm hoàn toàn trước Luật Pháp về nguồn gốc trong sạch của tài sản mang đi bảo đảm. Đảm bảo 100% tài sản thuộc quyền sở hữu riêng, không có tình trạng tranh chấp, vay mượn kép, hoặc bị cơ quan thi hành án kê biên tống đạt.</p>

      <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '20px 0 5px' }}>ĐIỀU 4. XỬ LÝ THANH LÝ TÀI SẢN KHẤT NỢ</h3>
      <p style={pStyle}>4.1. Trong trường hợp Bên B trốn tránh trách nhiệm, phá cấu trúc thanh toán trả nợ theo đúng kỳ hạn đã bàn thảo ở Hợp Đồng Vay Tiền.</p>
      <p style={pStyle}>4.2. Bên A có quyền tuyệt đối được <b>Đơn phương Thanh Lý, Chuyển Nhượng, Giải Toả</b> khối tài sản bảo đảm này cho bên thứ Ba để thu hồi nợ gốc và lãi. Số tiền thu được từ thanh lý sẽ tự động trừ đi toàn bộ nợ ròng mà Bên B đang vi phạm.</p>

      <table style={{ width: '100%', marginTop: '50px', textAlign: 'center', pageBreakInside: 'avoid' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%' }}>
              <b>BÊN {roleA} (BÊN A)</b><br/>
              <i>(Ký, điểm chỉ và ghi rõ họ tên)</i><br/><br/><br/><br/><br/><br/>
              <b>{shopData.name}</b>
            </td>
            <td style={{ width: '50%' }}>
              <b>BÊN {roleB} (BÊN B)</b><br/>
              <i>(Ký, điểm chỉ và ghi rõ họ tên)</i><br/><br/><br/><br/><br/><br/>
              <b style={{textTransform: 'uppercase'}}>{contract.customer_name}</b>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
