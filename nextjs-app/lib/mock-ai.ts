import { totals, businessDate, moneyText, todayTasks, overdueTasks, dueDebts } from './domain';
import { AREAS, type AppData, type Deal } from './types';
export type AIKind = 'briefing' | 'weekly' | 'accounting' | 'forecast' | 'script' | 'it';
export function mockAI(
  kind: AIKind,
  data: AppData,
  input = '',
  deal?: Deal,
  date = businessDate(),
) {
  const t = totals(data.transactions, date.slice(0, 7));
  const prefix = '🧪 Kết quả mô phỏng — chưa gọi dịch vụ AI thật.\n\n';
  if (kind === 'script')
    return (
      prefix +
      `Chào ${deal?.ten || 'anh/chị'}! Em gửi thông tin về ${deal?.product || 'dịch vụ đang quan tâm'}.\n\nEm có thể hỗ trợ tư vấn, hướng dẫn sử dụng và xác nhận nhu cầu trước khi triển khai. ${deal?.note || ''}\n\nMình tiện trao đổi thêm hôm nay không ạ?`
    );
  if (kind === 'it')
    return (
      prefix +
      `Về mô tả “${input || 'lỗi kỹ thuật'}”:\n1. Kiểm tra kết nối và thông báo lỗi cụ thể.\n2. Khởi động lại phần mềm, kiểm tra phiên bản driver/token.\n3. Ghi lại mã lỗi trước khi thay đổi cấu hình.\n\nNếu chưa xử lý được, hãy trao đổi với bộ phận hỗ trợ để kiểm tra trực tiếp.`
    );
  if (kind === 'forecast')
    return (
      prefix +
      `DỰ BÁO THAM KHẢO\nDựa trên dữ liệu hiện tại:\n• Thu tham chiếu: ${moneyText(t.thu)}\n• Chi tham chiếu: ${moneyText(t.chi)}\n• Chênh lệch: ${moneyText(t.net)}\n\nTheo dõi khoản đến hạn, xác nhận lịch thu tiền thuê và rà soát các khoản chi. Đây là kịch bản mẫu, không phải dự báo từ AI.`
    );
  const areaText = Object.entries(AREAS)
    .map(([key, value]) => {
      const n = totals(
        data.transactions.filter((r) => r.mang === key),
        date.slice(0, 7),
      );
      return n.count ? `• ${value.label}: Thu ${moneyText(n.thu)}, Chi ${moneyText(n.chi)}` : '';
    })
    .filter(Boolean)
    .join('\n');
  return (
    prefix +
    `${kind === 'weekly' ? 'TÓM TẮT TUẦN' : kind === 'accounting' ? 'PHÂN TÍCH THU CHI' : 'BRIEFING HÔM NAY'}\n\nHôm nay có ${todayTasks(data, date).length} việc cần làm, ${overdueTasks(data, date).length} việc quá hạn và ${dueDebts(data, date).length} khoản nợ đến hạn trong 7 ngày.\n\nTháng ${date.slice(0, 7)}: Thu ${moneyText(t.thu)}, Chi ${moneyText(t.chi)}, Lợi nhuận ${moneyText(t.net)}.\n${areaText}\n\nƯu tiên hoàn thành việc quá hạn, liên hệ khách có công nợ đến hạn và đối chiếu giao dịch cuối ngày.`
  );
}
export function parseMockVoice(text: string, date = businessDate()) {
  const match = text
    .toLowerCase()
    .replace(/,/g, '.')
    .match(/(\d+(?:\.\d+)?)\s*(triệu|trieu|tr|nghìn|nghin|ngàn|ngan|k|đồng|dong)?/);
  if (!match)
    throw new Error('Bản thử nghiệm nhận số bằng chữ số. Ví dụ: thu 1.5 triệu bán chữ ký số.');
  const unit = match[2] ?? '';
  const amount =
    Number(match[1]) *
    (/triệu|trieu|^tr$/.test(unit) ? 1e6 : /nghìn|nghin|ngàn|ngan|^k$/.test(unit) ? 1e3 : 1);
  const mang = /token|chữ ký|cks/i.test(text)
    ? 'cks'
    : /hóa đơn|hoá đơn|invoice/i.test(text)
      ? 'hd'
      : /thuê|căn hộ|nhà/i.test(text)
        ? 'apt'
        : /cổ phiếu|chứng khoán/i.test(text)
          ? 'ck'
          : 'kh';
  return {
    date,
    mang,
    desc: text,
    thu: /^\s*chi\b/i.test(text) ? 0 : amount,
    chi: /^\s*chi\b/i.test(text) ? amount : 0,
  };
}
