import type { Area, Stage } from './types';
export const SCRIPTS: Record<Area, Record<Stage, (name: string, product: string) => string>> = {
  cks: {
    new: (n: string, p: string) =>
      `Chào ${n || 'anh/chị'} 👋\n\nEm ${p ? `thấy mình đang cần ${p}, ` : ''}hỗ trợ cấp chữ ký số USB Token cho hộ KD & DN. Cấp trong ngày, cài đặt + hỗ trợ kỹ thuật miễn phí suốt thời hạn.\n\n${n || 'Anh/chị'} hiện đang ký tờ khai thuế bằng cách nào ạ?`,
    contact: (n: string, p: string) =>
      `${n || 'Anh/chị'} ơi, em gửi lại chi tiết:\n✅ ${p || 'USB Token CKS'} — cấp trong ngày\n✅ Cài đặt miễn phí tận nơi hoặc qua UltraViewer\n✅ Tương thích: HTKK, MISA, BKAV, eTax...\n✅ Bảo hành đổi token nếu lỗi\n\nGiá: [Điền giá] · Mình muốn lấy gói bao lâu ạ?`,
    nego: (n: string) =>
      `${n || 'Anh/chị'} ơi, giá bên em đã gồm cài đặt + hỗ trợ kỹ thuật 24/7 suốt thời hạn + bảo hành đổi mới nếu lỗi — không phát sinh thêm.\n\nNếu chốt hôm nay em giữ được giá này ạ 🙏 Mình quyết định được chưa?`,
    won: (n: string, p: string) =>
      `Em xác nhận đơn cho ${n || 'anh/chị'} ạ:\n📦 ${p || 'USB Token CKS'}\n📋 Em cần: CCCD (2 mặt) + Mã số thuế\nMình gửi qua Zalo này cho em được không ạ? 🙏`,
    lost: (n: string) =>
      `${n || 'Anh/chị'} ơi, cảm ơn đã quan tâm. Khi nào cần mình cứ nhắn em nhé — em vẫn luôn sẵn sàng hỗ trợ 😊`,
  },
  apt: {
    new: (n: string, p: string) =>
      `Chào ${n || 'anh/chị'} 👋\n\nEm có ${p || 'một số căn hộ cho thuê'} muốn giới thiệu — tư vấn miễn phí, không thu phí môi giới phía người thuê.\n\nMình đang tìm khu vực nào, tầm giá và diện tích bao nhiêu ạ?`,
    contact: (n: string, p: string) =>
      `${n || 'Anh/chị'} ơi, căn ${p || 'đang hỏi'} em giới thiệu:\n📍 [Địa chỉ cụ thể]\n💰 [Giá]/tháng | 🛏 [X]PN | [Y]m²\n🪑 Nội thất: [Đầy đủ/Cơ bản]\n📅 Vào: [Ngày]\n\nCuối tuần em dẫn xem nhà trực tiếp — mình muốn đặt lịch không ạ?`,
    nego: (n: string) =>
      `${n || 'Anh/chị'} ơi, về giá em sẽ trao đổi thêm với chủ nhà xem có linh hoạt được không. Mình cho em biết tầm giá mong muốn là bao nhiêu để em thương lượng ạ?`,
    won: (n: string) =>
      `${n || 'Anh/chị'} ơi, để hoàn tất hợp đồng em cần:\n📋 CCCD (2 mặt)\n💰 Tiền cọc + tháng đầu: [Số tiền]\n📅 Ngày ký HĐ: [Ngày]\n\nMình gửi CCCD qua Zalo này cho em được không ạ? 🏠`,
    lost: (n: string) =>
      `${n || 'Anh/chị'} ơi, không sao ạ — khi nào tìm nhà nữa cứ nhắn em, em luôn có thêm căn mới 😊`,
  },
  ck: {
    new: (n: string) =>
      `Chào ${n || 'anh/chị'} 👋\n\nEm hỗ trợ tư vấn đầu tư cổ phiếu cho nhà đầu tư cá nhân — mở TK online 15 phút, hỗ trợ phân tích danh mục miễn phí.\n\nMình hiện có bao nhiêu vốn và muốn đầu tư theo kiểu nào ạ (dài hạn/ngắn hạn)?\n⚠️ Chỉ mang tính tham khảo.`,
    contact: (n: string) =>
      `${n || 'Anh/chị'} ơi, tuần này thị trường:\n📊 VN-Index: [Nhận định xu hướng]\n🔵 Nhóm đáng chú ý: [Ngành]\n💡 Chiến lược: [Quan sát/Mua dần]\n\nEm chuẩn bị phân tích danh mục cho mình — hiện đang nắm những mã nào ạ?\n⚠️ Mang tính tham khảo.`,
    nego: (n: string) =>
      `${n || 'Anh/chị'} ơi, mở tài khoản bên em:\n✅ Online 15 phút, có app\n✅ Phí giao dịch cạnh tranh\n✅ Em hỗ trợ phân tích miễn phí\n\nMình muốn em hỗ trợ mở TK không ạ?`,
    won: (n: string) =>
      `Chúc mừng ${n || 'anh/chị'} đã mở TK thành công! 🎉\nEm sẽ theo dõi và cập nhật thị trường thường xuyên cho mình nhé!\n⚠️ Đầu tư có rủi ro.`,
    lost: (n: string) =>
      `${n || 'Anh/chị'} ơi, hoàn toàn không sao. Khi nào mình sẵn sàng hãy nhắn em, em luôn ở đây 😊`,
  },
  hd: {
    new: (n: string) =>
      `Chào ${n || 'anh/chị'} 👋\n\nEm hỗ trợ phần mềm hóa đơn điện tử — phù hợp từ hộ kinh doanh đến DN, kết nối MISA/FAST/BRAVO, cài đặt miễn phí.\n\n${n || 'Anh/chị'} đang dùng phần mềm kế toán nào? Cơ sở có bao nhiêu máy cần dùng ạ?`,
    contact: (n: string) =>
      `${n || 'Anh/chị'} ơi, tóm tắt giải pháp em đề xuất:\n✅ Phần mềm: [Tên]\n✅ Tích hợp: [Phần mềm KT đang dùng]\n✅ Cài đặt + training miễn phí\nGiá: [Điền giá]\n\nMình muốn demo thử trước không ạ?`,
    nego: (n: string) =>
      `${n || 'Anh/chị'} ơi, nếu chốt hôm nay em có thể hỗ trợ thêm [ưu đãi] ạ. Mình quyết định được chưa?`,
    won: (n: string) =>
      `Em xác nhận đơn ${n || 'anh/chị'} ạ:\n📋 Em cần: CCCD + MST + email đăng ký\nMình gửi qua đây được không ạ? 🙏`,
    lost: (n: string) => `${n || 'Anh/chị'} ơi, cảm ơn đã trao đổi. Khi nào cần hãy nhắn em nhé 😊`,
  },
  kh: {
    new: (n: string) =>
      `Chào ${n || 'anh/chị'} 👋\n\nEm muốn hỗ trợ thêm thông tin cho mình.\nMình có thể chia sẻ nhu cầu cụ thể không ạ?`,
    contact: (n: string) =>
      `${n || 'Anh/chị'} ơi, em gửi lại thông tin chi tiết như đã trao đổi. Mình có câu hỏi gì thêm không ạ?`,
    nego: (n: string) =>
      `${n || 'Anh/chị'} ơi, về điều khoản em có thể linh hoạt được. Điểm còn băn khoăn là gì ạ?`,
    won: (n: string) =>
      `Cảm ơn ${n || 'anh/chị'} đã tin tưởng! 🙏 Em xử lý ngay và cập nhật tiến độ cho mình ạ.`,
    lost: (n: string) => `${n || 'Anh/chị'} ơi, cảm ơn đã trao đổi. Khi nào cần cứ nhắn em 😊`,
  },
};

export const QUICK_SCRIPTS = [
  {
    id: 'cam-on',
    icon: '🙏',
    label: 'Cảm ơn',
    body: (n: string) =>
      `Cảm ơn ${n || 'anh/chị'} đã tin tưởng sử dụng dịch vụ! 🙏\nSau này có cần hỗ trợ gì cứ nhắn em nhé 😊`,
  },
  {
    id: 'follow-up',
    icon: '🔔',
    label: 'Follow-up',
    body: (n: string) =>
      `${n || 'Anh/chị'} ơi, lâu rồi không gặp — dạo này thế nào ạ?\nEm vẫn đang theo dõi và có tin mới muốn chia sẻ 😊`,
  },
  {
    id: 'cks-giahan',
    icon: '⏰',
    label: 'Nhắc gia hạn',
    body: (n: string) =>
      `${n || 'Anh/chị'} ơi, chứng thư số của mình sắp hết hạn rồi ạ!\n⏰ Nên gia hạn trước 30 ngày để không bị gián đoạn.\nEm hỗ trợ gia hạn online — thủ tục đơn giản, 1-2 ngày xong. Mình muốn em hỗ trợ không ạ?`,
  },
  {
    id: 'apt-thutien',
    icon: '💰',
    label: 'Nhắc thu tiền',
    body: (n: string) =>
      `${n || 'Anh/chị'} ơi, đã đến ngày thu tiền thuê tháng này rồi ạ.\nSố TK: [Số tài khoản]\nNội dung: Tiền thuê tháng [X]/2026\nSố tiền: [X.XXX.XXX]đ\n\nMình tiện chuyển khoản được không ạ? 🙏`,
  },
  {
    id: 'market',
    icon: '📊',
    label: 'Thị trường CK',
    body: (n: string) =>
      `${n || 'Anh/chị'} ơi, hôm nay thị trường:\n📈 VN-Index: [Điểm] ([+/-] điểm)\n🔥 Nhóm dẫn dắt: [Ngành]\n💡 Nhận định: [Tích cực/Thận trọng]\n\nDanh mục của mình hôm nay thế nào ạ?\n⚠️ Mang tính tham khảo.`,
  },
];
