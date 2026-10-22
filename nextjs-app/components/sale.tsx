'use client';
import { useState } from 'react';
import { useHub } from './demo-provider';
import { AREAS, STAGES, type Deal, type Stage } from '@/lib/types';
import { moneyText, shortMoney } from '@/lib/domain';
import { SCRIPTS, QUICK_SCRIPTS } from '@/lib/scripts';
import { AreaBadge, AreaSelect, Button, DeleteConfirm, Empty, KPIs, Modal, copyText } from './ui';
import { RecordEditor } from './record-editor';
import { AIDialog } from './ai-dialog';
import { CustomerDialog } from './customer-dialog';
export function Sale() {
  const hub = useHub();
  const { data } = hub;
  const [area, setArea] = useState('all');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<Deal | true | null>(null);
  const [remove, setRemove] = useState<Deal | null>(null);
  const [script, setScript] = useState<Deal | null>(null);
  const [stage, setStage] = useState<Stage>('new');
  const [ai, setAI] = useState<Deal | null>(null);
  const [customer, setCustomer] = useState<Deal | null>(null);
  const [quick, setQuick] = useState<string | null>(null);
  const filtered = data.deals.filter(
    (d) =>
      (area === 'all' || d.mang === area) &&
      [d.ten, d.product].some((v) => v.toLowerCase().includes(query.toLowerCase())),
  );
  const scriptText = script ? SCRIPTS[script.mang][stage](script.ten, script.product) : '';
  const openScript = (d: Deal) => {
    setScript(d);
    setStage(d.stage);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>💼 Sale Pipeline</h1>
          <p>Quản lý khách hàng từ tiếp cận đến chốt deal</p>
        </div>
        <Button onClick={() => setEditor(true)}>+ Thêm khách</Button>
      </div>
      <KPIs
        items={[
          {
            label: 'Đang chạy',
            value: data.deals.filter((d) => !['won', 'lost'].includes(d.stage)).length,
          },
          {
            label: 'Đã chốt',
            value: data.deals.filter((d) => d.stage === 'won').length,
            color: '#15803D',
          },
          {
            label: 'Giá trị đã chốt',
            value: moneyText(
              data.deals.filter((d) => d.stage === 'won').reduce((s, d) => s + d.value, 0),
            ),
            color: '#7C3AED',
          },
          { label: 'Tổng khách', value: data.deals.length },
        ]}
      />
      <div className="toolbar">
        <AreaSelect value={area} onChange={setArea} />
        <label className="inline-field">
          <span>Tìm khách hàng</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tên khách hoặc sản phẩm…"
          />
        </label>
      </div>
      <section className="section">
        <h2>Script Zalo</h2>
        <div className="button-row">
          {QUICK_SCRIPTS.map((t) => (
            <button className="small-button" key={t.id} onClick={() => setQuick(t.body(''))}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </section>
      <div className="kanban-board">
        {Object.entries(STAGES).map(([key, label], i) => (
          <section
            key={key}
            className="k-col"
            style={
              {
                '--col-color': ['#2563EB', '#D97706', '#16A34A', '#7C3AED', '#DC2626'][i],
              } as React.CSSProperties
            }
          >
            <div className="k-col-header">
              <h2>{label}</h2>
              <span>{filtered.filter((d) => d.stage === key).length}</span>
            </div>
            <div className="k-cards">
              {filtered
                .filter((d) => d.stage === key)
                .map((d) => (
                  <article key={d.id} className="deal-card">
                    <button className="deal-title-button" onClick={() => setEditor(d)}>
                      <strong className="deal-name">{d.ten}</strong>
                      <AreaBadge area={d.mang} />
                    </button>
                    <div className="deal-product">{d.product}</div>
                    <div className="deal-bottom">
                      <span className="deal-val" style={{ color: AREAS[d.mang].color }}>
                        {shortMoney(d.value)}
                      </span>
                      <span>{d.channel}</span>
                    </div>
                    <div className="deal-actions">
                      <button
                        className="da-btn"
                        disabled={d.stage === 'won' || d.stage === 'lost'}
                        onClick={() => {
                          const order: Stage[] = ['new', 'contact', 'nego', 'won'];
                          const index = order.indexOf(d.stage);
                          if (index >= 0 && index < 3)
                            hub.save('deals', { ...d, stage: order[index + 1] });
                        }}
                      >
                        → Tiến
                      </button>
                      <button className="da-btn" onClick={() => openScript(d)}>
                        ✍️ Script
                      </button>
                      <button className="da-btn da-btn-zalo" onClick={() => openScript(d)}>
                        📱 Zalo
                      </button>
                      <button className="da-btn da-btn-ai" onClick={() => setAI(d)}>
                        ✨ AI
                      </button>
                      <button className="da-btn" onClick={() => setCustomer(d)}>
                        360
                      </button>
                      <button
                        className="da-btn da-btn-r"
                        aria-label={'Xóa ' + d.ten}
                        onClick={() => setRemove(d)}
                      >
                        ✕
                      </button>
                    </div>
                  </article>
                ))}
              {!filtered.some((d) => d.stage === key) && <Empty>Chưa có khách</Empty>}
            </div>
          </section>
        ))}
      </div>
      {editor && (
        <RecordEditor
          collection="deals"
          record={editor === true ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}{' '}
      {remove && (
        <DeleteConfirm
          collection="deals"
          id={remove.id}
          title={remove.ten}
          onClose={() => setRemove(null)}
        />
      )}{' '}
      {script && (
        <Modal title={'📱 Script cho ' + script.ten} onClose={() => setScript(null)}>
          <div className="filter-tabs">
            {Object.entries(STAGES).map(([key, label]) => (
              <button
                className={stage === key ? 'active' : ''}
                key={key}
                onClick={() => setStage(key as Stage)}
              >
                {label}
              </button>
            ))}
          </div>
          <pre className="text-preview">{scriptText}</pre>
          <p className="muted">
            Bản thử nghiệm chỉ chuẩn bị nội dung, không mở cuộc trò chuyện hoặc gửi tin thật.
          </p>
          <div className="modal-actions">
            <Button onClick={() => void copyText(scriptText, hub.notify)}>
              📋 Copy script Zalo
            </Button>
          </div>
        </Modal>
      )}{' '}
      {quick && (
        <Modal title="Script Zalo" onClose={() => setQuick(null)}>
          <pre className="text-preview">{quick}</pre>
          <Button onClick={() => void copyText(quick, hub.notify)}>Copy script</Button>
        </Modal>
      )}{' '}
      {ai && <AIDialog kind="script" deal={ai} onClose={() => setAI(null)} />}{' '}
      {customer && (
        <CustomerDialog
          deal={customer}
          onClose={() => setCustomer(null)}
          onEdit={() => {
            setEditor(customer);
            setCustomer(null);
          }}
        />
      )}
    </>
  );
}
