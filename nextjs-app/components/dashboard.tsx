'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useHub } from './demo-provider';
import {
  businessDate,
  dueDebts,
  overdueTasks,
  todayTasks,
  isDone,
  totals,
  moneyText,
  dueLabel,
  shortMoney,
} from '@/lib/domain';
import { KPIs, Section, Empty, Button, copyText } from './ui';
import { AIDialog } from './ai-dialog';
import { TelegramPreview } from './telegram-preview';
import type { AIKind } from '@/lib/mock-ai';
export function Dashboard() {
  const hub = useHub();
  const { data } = hub;
  const date = businessDate();
  const t = totals(data.transactions, date.slice(0, 7));
  const [ai, setAI] = useState<AIKind | null>(null);
  const [telegram, setTelegram] = useState(false);
  const debts = data.debts.reduce((s, d) => s + Math.max(d.amount - d.paid, 0), 0);
  const todo = data.todos.filter((t) => !isDone(t));
  const active = data.deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const cash = totals(data.transactions).net;
  const empty = data.apartments.filter((a) => a.status !== 'occupied').length;
  const health = Math.max(
    0,
    Math.min(
      100,
      72 +
        (t.net > 0 && t.thu > 0 ? 8 : 0) -
        (debts > t.thu * 0.4 ? 12 : 0) -
        (todo.length > 10 ? 8 : 0) -
        Math.min(10, empty * 4) -
        (cash < 0 ? 12 : 0),
    ),
  );
  const briefing = `MORNING BRIEFING — ${date}\n\n💰 Tháng này: Thu ${moneyText(t.thu)} · Chi ${moneyText(t.chi)}\n📈 Lợi nhuận: ${moneyText(t.net)}\n📋 Công nợ còn lại: ${moneyText(debts)}\n✅ ${todayTasks(data, date).length} việc hôm nay · ${overdueTasks(data, date).length} việc quá hạn\n💼 ${active.length} deal đang chạy · ${data.deals.filter((d) => d.stage === 'won').length} đã chốt\n\n💪 Chúc ngày làm việc hiệu quả!`;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Tổng quan</h1>
          <p>
            {new Intl.DateTimeFormat('vi-VN', {
              dateStyle: 'full',
              timeZone: 'Asia/Ho_Chi_Minh',
            }).format(new Date())}
          </p>
        </div>
        <Link href="/operations" className="small-button">
          ✅ Xem việc hôm nay
        </Link>
      </div>
      <KPIs
        items={[
          { label: 'Tổng thu tháng này', value: moneyText(t.thu), color: '#15803D' },
          { label: 'Tổng chi tháng này', value: moneyText(t.chi), color: '#B91C1C' },
          {
            label: 'Lợi nhuận',
            value: moneyText(t.net),
            color: t.net >= 0 ? '#15803D' : '#B91C1C',
          },
          {
            label: 'Công nợ còn lại',
            value: moneyText(debts),
            sub: `${data.debts.filter((d) => d.amount > d.paid && d.dueDate && d.dueDate < date).length} khoản quá hạn`,
            color: '#D97706',
          },
        ]}
      />
      <div className="two-columns">
        <Section title="Sức khỏe kinh doanh">
          <div className="health-strip">
            <div className="health-number">
              {health}
              <small>/100</small>
            </div>
            <div>
              <p>
                Tiền mặt <strong>{moneyText(cash)}</strong>
              </p>
              <p className="muted">
                {active.length} deal đang chạy · {todo.length} việc tồn · {empty} căn trống
              </p>
              <p className="muted">Điểm tổng hợp từ dữ liệu mẫu, theo công thức của ứng dụng.</p>
            </div>
          </div>
        </Section>
        <Section
          title="Việc ưu tiên cần xử lý"
          action={<Link href="/operations">Xem tất cả →</Link>}
        >
          <div className="priority-list">
            {[...overdueTasks(data, date), ...todayTasks(data, date)].slice(0, 5).map((t) => (
              <Link href="/operations" className="priority-row" key={t.id}>
                <span>{t.dueDate < date ? '⚠️' : '✅'}</span>
                <strong>{t.text}</strong>
                <span>{dueLabel(t.dueDate, date)}</span>
              </Link>
            ))}
            {!todo.length && <Empty>Không có việc cần xử lý.</Empty>}
          </div>
        </Section>
      </div>
      <div className="three-columns">
        <Section title="💼 Sale Pipeline">
          <p>
            <strong>{active.length}</strong> deal đang chạy
          </p>
          <p className="muted">Giá trị {moneyText(active.reduce((s, d) => s + d.value, 0))}</p>
          <Link className="small-button" href="/sale">
            Xem pipeline
          </Link>
        </Section>
        <Section title="📋 Cần thu trong 7 ngày">
          <p>
            <strong>{dueDebts(data, date).length}</strong> khoản đến hạn
          </p>
          <p className="muted">
            Tổng {moneyText(dueDebts(data, date).reduce((s, d) => s + d.amount - d.paid, 0))}
          </p>
          <Link className="small-button" href="/debts">
            Xem công nợ
          </Link>
        </Section>
        <Section title="🏠 Căn hộ">
          <p>
            <strong>{data.apartments.length}</strong> căn · {empty} trống
          </p>
          <p className="muted">
            Thu cố định{' '}
            {shortMoney(
              data.apartments
                .filter((a) => a.status === 'occupied')
                .reduce((s, a) => s + a.price, 0),
            )}
            /tháng
          </p>
          <Link className="small-button" href="/operations">
            Xem vận hành
          </Link>
        </Section>
      </div>
      <Section title="🔥 Deal nóng cần follow hôm nay">
        {active
          .filter((d) => d.priority === 'hot' && d.nextdate && d.nextdate <= date)
          .map((d) => (
            <Link href="/sale" key={d.id} className="summary-line">
              <strong>{d.ten}</strong>
              <span>
                {d.product} · {moneyText(d.value)}
              </span>
            </Link>
          ))}
      </Section>
      <Section title="⚡ AI Shortcuts">
        <div className="button-row">
          <Link href="/accounting" className="small-button">
            🎙️ Nói để nhập thu chi
          </Link>
          <Button secondary onClick={() => setAI('briefing')}>
            🧠 Briefing thông minh
          </Button>
          <Button secondary onClick={() => setAI('forecast')}>
            📈 Dự báo tháng tới
          </Button>
          <Button secondary onClick={() => setAI('it')}>
            🤖 IT Chatbot
          </Button>
          <Button secondary onClick={() => setAI('weekly')}>
            🤖 Tóm tắt tuần
          </Button>
        </div>
      </Section>
      <div className="overview-briefing">
        <div className="section-title">
          <h2>📱 MORNING BRIEFING</h2>
          <div className="button-row">
            <Button secondary onClick={() => void copyText(briefing, hub.notify)}>
              📋 Copy
            </Button>
            <Button
              secondary
              onClick={() => {
                void copyText(briefing, hub.notify);
                hub.notify('Đã chuẩn bị nội dung Zalo. Bản thử nghiệm không gửi tin.');
              }}
            >
              📱 Chuẩn bị gửi Zalo
            </Button>
            <Button secondary onClick={() => setTelegram(true)}>
              📨 Báo cáo Telegram 07:00
            </Button>
          </div>
        </div>
        <pre>{briefing}</pre>
      </div>
      {ai && <AIDialog kind={ai} onClose={() => setAI(null)} />}{' '}
      {telegram && <TelegramPreview onClose={() => setTelegram(false)} />}
    </>
  );
}
