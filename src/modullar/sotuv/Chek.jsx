// ============================================================
//  CHEK (RECEIPT) MODALI
// ------------------------------------------------------------
//  Chop etishda faqat `.receipt-print` ko'rinadi (index.css @media print).
//  Chek tanasi `ReceiptBody` komponentiga ajratilgan — u ikki marta
//  chiziladi: (1) ko'rinadigan chek, (2) ekrandan tashqari, DOIM NARXSIZ
//  nusxa — uning rasmi botga albom bilan birga yuboriladi.
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { Printer, Receipt, MapPin, Phone, Heart, CheckCircle2, Clock, XCircle, Send, MessageCircle, Truck, EyeOff, Check, Scissors, Loader2 } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { fmt, formatDate, rangHex, rangMatn } from '../../lib/helpers.js';
import { applyTil, getTil } from '../../lib/til.js';
import { KanyokImg, TeskariBadge, rangChipStyle } from '../../components/ui.jsx';
import { itemDisp } from './Zakazlar.jsx';
import { kazRowNom } from './KazirokSavdo.jsx';
import { nestKazirok, SHEET_LENGTHS } from '../../lib/nesting.js';
import { nestsToDxfFiles, downloadDxf } from '../../lib/dxfExport.js';
import { sendDxfAlbumToTelegram, telegramSozlangan } from '../../lib/telegram.js';
import { fsSupported, ensurePermission, getOrderFolder, writeFile, orderFolderName } from '../../lib/fsLibrary.js';

const HOLAT_LABEL = { jarayon: 'Jarayonda', tayyor: 'Tayyor', yopilgan: 'Yopilgan' };

// DXF list uzunliklari (tugmalar) — uzunligi bo'yicha tartiblangan: 3m,4m,6m,8m,10m,12m
const DXF_LENGTHS = Object.keys(SHEET_LENGTHS).sort((a, b) => SHEET_LENGTHS[a] - SHEET_LENGTHS[b]);

function RangChip({ rang }) {
  if (!rang) return <span>—</span>;
  return <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold border border-black/10 whitespace-nowrap" style={rangChipStyle(rang)}>{rang}</span>;
}

// Chek tugunini PNG blob'ga oladi. Ichidagi rasmlar (kanyok PNG) DECODE bo'lishini
// kutadi (aks holda chek rasmi chala chiqadi), so'ng eng ko'pi 2 marta urinadi
// (html-to-image ba'zan birinchi urinishda null qaytaradi). Xatoda null.
async function captureReceipt(node) {
  if (!node) return null;
  try {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch (e) { /* noop */ }
  try {
    const imgs = [...node.querySelectorAll('img')];
    await Promise.all(imgs.map((im) => (im && im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
  } catch (e) { /* decode ixtiyoriy */ }
  // Layout joylashishi uchun bitta kadr kutamiz (offscreen tugun chizilib bo'lsin)
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let blob = null;
  for (let i = 0; i < 3 && !blob; i++) {
    try {
      blob = await toBlob(node, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
    } catch (e) { blob = null; }
  }
  return blob;
}

// Chek rasmi fayl nomi uchun vaqt belgisi (soniyagacha — har safar yangi)
function chekStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

// ===== CHEK TANASI — narxsiz prop bilan boshqariladi (narxlar yashirinadi) =====
function ReceiptBody({ order, shopName, shopPhone, narxsiz, statBadge, olishUsd, sotishUsd, kRows, ustaTel = [] }) {
  return (
    <>
      {/* Accent sarlavha tasmasi (mavzu rangida) */}
      <div className="bg-slate-900 text-white px-6 pt-6 pb-5 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/15 mb-2">
          <Receipt className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight leading-none">{shopName}</h1>
        <p className="text-[11px] opacity-80 mt-1.5 uppercase tracking-[0.25em]">Zakas · Chek</p>
        <div className="flex justify-center flex-wrap gap-1.5 mt-3">
          <span className="px-3 py-1 rounded-full bg-white/15 text-[11px] font-semibold">№ {order.number}</span>
          <span className="px-3 py-1 rounded-full bg-white/15 text-[11px]">{formatDate(order.createdAt)}</span>
          {order.masterName && order.masterName !== 'Boshqa' && (
            <span className="px-3 py-1 rounded-full bg-white/15 text-[11px]">Usta: {order.masterName}{ustaTel && ustaTel.length ? ` · ${ustaTel.join(', ')}` : ''}</span>
          )}
        </div>
      </div>

      <div className="p-6 pt-5">
        <div className="border border-slate-300 rounded-lg p-2.5 mb-3 text-xs bg-slate-50">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Mijoz</div>
          <div className="font-bold text-sm">{order.customer.name}</div>
          {order.customer.phones?.filter(Boolean).length > 0 && (
            <div className="text-slate-600">{order.customer.phones.filter(Boolean).join(', ')}</div>
          )}
          {order.customer.address && <div className="text-slate-600">{order.customer.address}</div>}
          {order.customer.orientir && <div className="text-slate-600 flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" /> {order.customer.orientir}</div>}
        </div>

        <table className="w-full text-xs mb-3">
          <thead>
            <tr className="text-left bg-slate-100">
              <th className="py-1.5 px-2 font-semibold rounded-l-md">Nomi</th>
              <th className="py-1.5 px-1 font-semibold">Rang</th>
              <th className="py-1.5 px-1 font-semibold text-right">O'lchov</th>
              {!narxsiz && <th className="py-1.5 px-1 font-semibold text-right">Narxi</th>}
              {!narxsiz && <th className="py-1.5 px-2 font-semibold text-right rounded-r-md">Jami</th>}
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => {
              const d = itemDisp(it);
              return (
                <tr key={it.id} className="border-b border-slate-200 align-top">
                  <td className="py-1.5 px-2">
                    <div className="font-medium flex items-center flex-wrap gap-1">{d.nomi}<KanyokImg item={it} size="w-14 h-8" /><TeskariBadge item={it} /></div>
                    <div className="text-slate-500">{d.tafsilot}</div>
                  </td>
                  <td className="py-1.5 px-1"><RangChip rang={it.rang} /></td>
                  <td className="py-1.5 px-1 text-right tabular-nums">{d.olchov}</td>
                  {!narxsiz && <td className="py-1.5 px-1 text-right tabular-nums">{fmt(it.birBirlikNarxi)} so'm</td>}
                  {!narxsiz && <td className="py-1.5 px-2 text-right tabular-nums font-semibold">{fmt(d.jami)}</td>}
                </tr>
              );
            })}
            {(order.aksessuarlar || []).map((a) => (
              <tr key={a.id} className="border-b border-slate-200 align-top">
                <td className="py-1.5 px-2"><div className="font-medium">{a.nomi}</div><div className="text-slate-500">Aksessuar</div></td>
                <td className="py-1.5 px-1"><RangChip rang={a.rang} /></td>
                <td className="py-1.5 px-1 text-right tabular-nums">{a.soni} {a.birlik || 'dona'}</td>
                {!narxsiz && <td className="py-1.5 px-1 text-right tabular-nums">{fmt(a.narx)} so'm</td>}
                {!narxsiz && <td className="py-1.5 px-2 text-right tabular-nums font-semibold">{fmt(a.jami)}</td>}
              </tr>
            ))}
            {/* KAZIROK — chizmadan avtomatik (material + 25% xizmat) */}
            {kRows.map((r, i) => (
              <tr key={'kaz' + i} className="border-b border-slate-200 align-top">
                <td className="py-1.5 px-2">
                  <div className="font-medium">{kazRowNom(r)}</div>
                  <div className="text-slate-500">{r.listNom}{r.sizeLabel ? ` · ${r.sizeLabel}` : ''}</div>
                </td>
                <td className="py-1.5 px-1"><RangChip rang={r.rang} /></td>
                <td className="py-1.5 px-1 text-right tabular-nums">{r.metr.toFixed(2)} m</td>
                {!narxsiz && <td className="py-1.5 px-1 text-right tabular-nums">{fmt(r.price)}+25%</td>}
                {!narxsiz && <td className="py-1.5 px-2 text-right tabular-nums font-semibold">{fmt(r.jami)}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        {!narxsiz && order.dastafka && (order.dastafka.ichida || order.dastafka.summa > 0) && (
          <div className="flex justify-between items-center text-xs mb-3 px-1 border border-slate-200 rounded-lg p-2 bg-slate-50">
            <span className="text-slate-600 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Dastafka xizmati</span>
            <span className="font-semibold text-slate-800">{order.dastafka.ichida ? 'Ichida (narxga kiritilgan)' : `${fmt(order.dastafka.summa)} so'm`}</span>
          </div>
        )}

        {!narxsiz && statBadge && (
          <div className="flex justify-center mb-3">
            <span className={`px-4 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 ${statBadge.c}`}><statBadge.Icon className="w-3.5 h-3.5" />{statBadge.t}</span>
          </div>
        )}

        {!narxsiz && (
        <div className="rounded-xl border-2 border-slate-900 overflow-hidden">
          <div className="flex justify-between items-center bg-slate-900 text-white px-3 py-2.5">
            <span className="text-sm font-semibold">Umumiy summa</span>
            <b className="text-lg tabular-nums">{fmt(order.totalSum)} so'm</b>
          </div>
          <div className="p-3 space-y-1.5">
            <div className="flex justify-between text-sm text-emerald-800"><span>To'landi</span><b className="tabular-nums">{fmt(order.totalPaid)} so'm</b></div>
            <div className="flex justify-between items-center text-base pt-2 border-t-2 border-slate-200">
              <span className="font-bold">Qoldiq qarz</span>
              <div className="text-right">
                <b className="tabular-nums text-amber-800 block">{fmt(order.debt)} so'm</b>
                {olishUsd > 0 && <span className="text-[11px] text-slate-500 tabular-nums block">Olish: ≈ {olishUsd.toFixed(1)} $</span>}
                {sotishUsd > 0 && <span className="text-[11px] text-slate-500 tabular-nums block">Sotish: ≈ {sotishUsd.toFixed(1)} $</span>}
              </div>
            </div>
          </div>
        </div>
        )}

        {!narxsiz && order.payments && order.payments.length > 0 && (
          <div className="mt-3 text-[11px] text-slate-600">
            <div className="font-semibold mb-0.5">To'lovlar:</div>
            {order.payments.map((p) => (
              <div key={p.id} className="flex justify-between border-b border-slate-100 py-0.5 last:border-0">
                <span>{formatDate(p.createdAt)} · {p.method}</span>
                <span className="tabular-nums">{p.method === 'Dollorda' ? `${p.amount} $` : `${fmt(p.amount)} so'm`}</span>
              </div>
            ))}
          </div>
        )}

        {order.notes && (
          <div className="mt-3 text-xs border border-slate-300 rounded-lg p-2 bg-slate-50">
            <b>Izoh:</b> {order.notes}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-dashed border-slate-300 text-center">
          <div className="text-slate-300 tracking-[0.5em] text-xs mb-1">• • • • •</div>
          <p className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">Xaridingiz uchun rahmat! <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /></p>
          <div className="text-[11px] text-slate-400 mt-1">{shopName}</div>
          {shopPhone && <div className="text-sm font-bold text-slate-700 mt-0.5 flex items-center justify-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {shopPhone}</div>}
        </div>
      </div>
    </>
  );
}

export function ReceiptModal({ order, shopName, shopPhone, usdRate, usdOlish, kazData = { groups: [] }, kazRows = [], tunikaBaza = [], ustalar = [], telegram = {}, libRoot = null, onChatMigrated = () => {}, onClose }) {
  const printRef = useRef(null);
  const dxfImgRef = useRef(null);                   // ekrandan tashqari, DOIM narxsiz chek (albom rasmi uchun)
  const [narxsiz, setNarxsiz] = useState(false);   // narxsiz rejim — narxlarni yashiradi (oldindan yoqiladi)
  const [busy, setBusy] = useState(false);          // rasm tayyorlanmoqda
  const [dxfBusy, setDxfBusy] = useState('');       // '' | '4m' | '6m' — DXF tayyorlanyapti
  const [dxfMsg, setDxfMsg] = useState(null);       // { ok, t } — natija xabari

  // Kazirok manbai: AVVAL zakasникidan (saqlangan), bo'lmasa joriy chizmadan (jonli).
  const kData = (order && order.kazData && (
      (order.kazData.groups && order.kazData.groups.length) ||
      (order.kazData.qoz && order.kazData.qoz.length)
    ))
    ? order.kazData : kazData;
  const kRows = (order && order.kazRows && order.kazRows.length) ? order.kazRows : kazRows;
  const kazGroups = (kData && kData.groups) || [];
  const kazQoz = (kData && kData.qoz) || [];   // tashqi burchak qozonlar
  const hasKaz = kazGroups.length > 0 || kazQoz.length > 0;
  const listNameById = (id) => {
    const t = tunikaBaza.find((x) => String(x.id) === String(id));
    return t ? t.nomi : (id ? String(id) : 'List');
  };
  // Usta telefoni — zakasda faqat masterId saqlanadi, raqamni ustalar ro'yxatidan topamiz
  const usta = order ? (ustalar || []).find((u) => String(u.id) === String(order.masterId)) : null;
  const ustaTel = ((usta && usta.phones) || []).filter(Boolean);
  const libReady = !!(libRoot && fsSupported());
  const dxfBtnLabel = libReady ? 'Papkaga DXF' : telegramSozlangan(telegram) ? 'Botga DXF' : 'DXF';
  const dxfWhere = libReady ? ' mijoz papkasiga saqlanadi' : telegramSozlangan(telegram) ? ' albom bo\'lib botga yuboriladi' : ' yuklab olinadi';

  // Zakas izohi (PULSIZ) — albom ostidagi yozuv: mijoz, usta, sana, holat
  function buildDxfCaption(lengthKey, fileCount, usedM) {
    const L = [];
    L.push(shopName);
    L.push(`Zakas № ${order.number}`);
    L.push(`Mijoz: ${order.customer.name}`);
    const tels = (order.customer.phones || []).filter(Boolean);
    if (tels.length) L.push(`Tel: ${tels.join(', ')}`);
    if (order.customer.address) L.push(`Manzil: ${order.customer.address}`);
    if (order.customer.orientir) L.push(`Orientir: ${order.customer.orientir}`);
    if (order.masterName && order.masterName !== 'Boshqa') {
      L.push(`Usta: ${order.masterName}${ustaTel.length ? ` (${ustaTel.join(', ')})` : ''}`);
    }
    L.push(`Sana: ${formatDate(order.createdAt)}`);
    L.push(`Holat: ${HOLAT_LABEL[order.holat || 'jarayon'] || 'Jarayonda'}`);
    L.push(`✂️ DXF: ${lengthKey} · ${fileCount} ta · ~${usedM} m`);
    return L.join('\n');
  }

  // Kazirok bo'laklarini listga aqlli joylab (1245 mm × 4/6 m) har List uchun
  // alohida DXF yasaydi; Telegram sozlangan bo'lsa narxsiz chek rasmi + DXFlar
  // bitta albom bo'lib har manzilga yuboriladi, aks holda yuklab oladi.
  async function makeAndSendDxf(lengthKey) {
    if (dxfBusy || !hasKaz) return;
    setDxfBusy(lengthKey); setDxfMsg(null);
    try {
      const sheetL = SHEET_LENGTHS[lengthKey];
      const nests = nestKazirok(kData, { sheetL });
      if (!nests.length) { setDxfMsg({ ok: false, t: 'Kazirok bo\'laklari topilmadi' }); return; }
      // Haqiqiy sarflangan material uzunligi (1.25 m enli list bo'ylab)
      const totUsedMm = nests.reduce((a, n) => a + n.sheets.reduce((s, sh) => s + (sh.usedL || 0), 0), 0);
      const usedM = (totUsedMm / 1000).toFixed(2);
      const custName = (order.customer && order.customer.name) || '';
      // Har sheet alohida fayl: patalok/paloska_List_6m_Ism_Familiya_N.dxf
      const files = nestsToDxfFiles(nests, listNameById, lengthKey, custName);
      const done = [];

      // 1) Mijozlar kutubxonasi — papkaga yozish (Ism Familiya + sana-soat papkasi)
      if (libRoot && fsSupported()) {
        if (await ensurePermission(libRoot)) {
          const folderName = orderFolderName(custName, order.createdAt);
          const dir = await getOrderFolder(libRoot, folderName);
          for (const f of files) await writeFile(dir, f.name, f.text);
          // Chek rasmini ham shu papkaga (har safar yangi — to'lov tarixi uchun)
          try {
            const blob = await toBlob(printRef.current, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
            if (blob) await writeFile(dir, 'chek_' + chekStamp() + '.png', blob);
          } catch (e) { /* chek rasmi ixtiyoriy */ }
          done.push('papka: ' + folderName);
        } else {
          setDxfMsg({ ok: false, t: 'Papkaga yozishga ruxsat berilmadi' }); return;
        }
      }

      // 2) Telegram bot — narxsiz chek RASMI (qisqartirilmaydi) + DXFlar bitta albom
      if (telegramSozlangan(telegram)) {
        const imageBlob = await captureReceipt(dxfImgRef.current);
        const caption = buildDxfCaption(lengthKey, files.length, usedM);
        const res = await sendDxfAlbumToTelegram(telegram, {
          imageBlob,
          imageName: `chek_zakas-${order.number}.png`,
          files,
          caption,
          onChatMigrated,
        });
        done.push(`albom → ${res.sent.length} manzil (${res.sent.join(', ')})`);
        if (!imageBlob) done.push('⚠️ chek rasmi yaratilmadi — faqat DXF ketdi');
        if (res.errors && res.errors.length) done.push('⚠️ ' + res.errors.join('; '));
      }

      // 3) Hech biri sozlanmagan — oddiy yuklab olish
      if (!done.length) {
        files.forEach((f) => downloadDxf(f.name, f.text));
        done.push('yuklab olindi');
      }

      setDxfMsg({ ok: true, t: `${files.length} ta DXF (${lengthKey}) · ~${usedM} m — ${done.join(' · ')}` });
    } catch (e) {
      setDxfMsg({ ok: false, t: (e && e.message) || 'Xatolik yuz berdi' });
    } finally {
      setDxfBusy('');
    }
  }

  // Chek ochilganda / narxsiz o'zgarganda — interfeys tilini chekka ham qo'llaymiz
  useEffect(() => { applyTil(getTil()); }, [narxsiz, order]);

  if (!order) return null;
  const olishUsd = usdOlish > 0 && order.debt > 0 ? order.debt / usdOlish : 0;
  const sotishUsd = usdRate > 0 && order.debt > 0 ? order.debt / usdRate : 0;
  const statBadge = {
    paid:    { t: "To'liq to'langan", Icon: CheckCircle2, c: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    partial: { t: 'Qisman to\'langan', Icon: Clock,       c: 'bg-amber-100 text-amber-800 border-amber-300' },
    unpaid:  { t: "To'lanmagan",       Icon: XCircle,     c: 'bg-red-100 text-red-800 border-red-300' },
  }[order.status] || null;

  // Zakas xulosasi — mijozga yuborish uchun matn (WhatsApp/Telegram)
  function buildText() {
    const L = [];
    L.push(shopName);
    L.push(`Zakas № ${order.number} · ${formatDate(order.createdAt)}`);
    L.push(`Mijoz: ${order.customer.name}`);
    L.push('');
    order.items.forEach((it) => {
      const d = itemDisp(it);
      L.push(`• ${d.nomi}${it.rang ? ` (${it.rang})` : ''} — ${d.olchov}${narxsiz ? '' : ` = ${fmt(d.jami)} so'm`}`);
    });
    (order.aksessuarlar || []).forEach((a) => L.push(`• ${a.nomi} — ${a.soni} ${a.birlik || 'dona'}${narxsiz ? '' : ` = ${fmt(a.jami)} so'm`}`));
    kRows.forEach((r) => L.push(`• ${kazRowNom(r)} (${r.listNom}) — ${r.metr.toFixed(2)} m${narxsiz ? '' : ` = ${fmt(r.jami)} so'm`}`));
    if (!narxsiz) {
      if (order.dastafka?.ichida) L.push('Dastafka xizmati: ichida (narxga kiritilgan)');
      else if (order.dastafka?.summa > 0) L.push(`Dastafka xizmati: ${fmt(order.dastafka.summa)} so'm`);
      L.push('');
      L.push(`Umumiy: ${fmt(order.totalSum)} so'm`);
      L.push(`To'landi: ${fmt(order.totalPaid)} so'm`);
      if (order.debt > 0) L.push(`Qoldiq qarz: ${fmt(order.debt)} so'm`);
    }
    if (shopPhone) L.push(`Tel: ${shopPhone}`);
    return L.join('\n');
  }
  // Mijozning birinchi telefoni (xalqaro format, faqat raqam)
  function mijozTel() {
    const raw = (order.customer.phones || []).filter(Boolean)[0] || '';
    let d = raw.replace(/\D/g, '');
    if (d.startsWith('998')) return d;
    if (d.length === 9) return `998${d}`;
    return d;
  }
  // Matn bilan ochish (rasm ulashib bo'lmasa — zaxira)
  function openMatn(app) {
    const text = encodeURIComponent(buildText());
    if (app === 'wa') {
      const tel = mijozTel();
      window.open(tel ? `https://wa.me/${tel}?text=${text}` : `https://wa.me/?text=${text}`, '_blank', 'noopener');
    } else {
      window.open(`https://t.me/share/url?url=${text}`, '_blank', 'noopener');
    }
  }
  // Chekning RASMINI yuborish (WhatsApp/Telegram — qurilma ulashish oynasi orqali)
  async function shareImage(app) {
    if (!printRef.current || busy) return;
    setBusy(true);
    try {
      const blob = await toBlob(printRef.current, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
      if (!blob) throw new Error('rasm yo\'q');
      const file = new File([blob], `zakas-${order.number}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Zakas № ${order.number}`, text: shopName });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
        URL.revokeObjectURL(url);
        openMatn(app);
      }
    } catch (e) {
      openMatn(app);
    } finally {
      setBusy(false);
    }
  }
  const sendWhatsApp = () => shareImage('wa');
  const sendTelegram = () => shareImage('tg');

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl my-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== CHOP ETILADIGAN QISM ===== */}
        <div ref={printRef} className="receipt-print text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>
          <ReceiptBody order={order} shopName={shopName} shopPhone={shopPhone} narxsiz={narxsiz}
            statBadge={statBadge} olishUsd={olishUsd} sotishUsd={sotishUsd} kRows={kRows} ustaTel={ustaTel} />
        </div>

        {/* ===== TUGMALAR (chop etishda ko'rinmaydi) ===== */}
        <div className="no-print p-4 border-t border-slate-100 space-y-2">
          {/* NARXSIZ — chop/yuborishdan OLDIN yoqiladi; yoqilsa barcha narxlar yashirinadi */}
          <button onClick={() => setNarxsiz((v) => !v)} aria-label="Narxsiz rejim"
            className={`w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 border-2 transition ${
              narxsiz ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}>
            <EyeOff className="w-4 h-4" /> Narxsiz rejim {narxsiz && <><span>— yoqilgan</span><Check className="w-4 h-4" /></>}
          </button>
          <p className="text-[11px] text-slate-400 text-center">
            Chek RASMI sifatida yuboriladi{narxsiz ? ' · narxlarsiz' : ''}
          </p>
          <div className="flex gap-2">
            <button onClick={sendWhatsApp} disabled={busy} aria-label="WhatsApp orqali rasm yuborish"
              className="flex-1 py-3 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
              <MessageCircle className="w-4 h-4" /> {busy ? 'Tayyorlanmoqda…' : 'WhatsApp'}
            </button>
            <button onClick={sendTelegram} disabled={busy} aria-label="Telegram orqali rasm yuborish"
              className="flex-1 py-3 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 disabled:opacity-50 flex items-center justify-center gap-2">
              <Send className="w-4 h-4" /> {busy ? 'Tayyorlanmoqda…' : 'Telegram'}
            </button>
          </div>
          {/* KAZIROK — aqlli sartirovka + DXF (narxsiz chek rasmi bilan albom botga, yoki yuklab olish) */}
          {hasKaz && (
            <div className="pt-2 mt-1 border-t border-slate-100">
              <p className="text-[11px] text-slate-500 text-center mb-1.5 flex items-center justify-center gap-1 flex-wrap">
                <Scissors className="w-3 h-3 flex-shrink-0" /> Patalok/Paloska/Burchak qozon 1245&nbsp;mm listga zich joylanib, narxsiz chek rasmi + har sheet DXF{dxfWhere}
              </p>
              <div className="text-[11px] text-slate-500 text-center mb-1">{dxfBtnLabel} — list uzunligini tanlang:</div>
              <div className="grid grid-cols-3 gap-2">
                {DXF_LENGTHS.map((lk) => (
                  <button key={lk} onClick={() => makeAndSendDxf(lk)} disabled={!!dxfBusy} aria-label={`Kazirok DXF ${lk}`}
                    className="py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {dxfBusy === lk ? <Loader2 className="w-4 h-4 anim-spin" /> : <Scissors className="w-4 h-4" />}
                    {lk}
                  </button>
                ))}
              </div>
              {dxfMsg && (
                <p className={`text-[11px] text-center mt-1.5 font-semibold ${dxfMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{dxfMsg.t}</p>
              )}
              {!libReady && !telegramSozlangan(telegram) && (
                <p className="text-[10px] text-slate-400 text-center mt-1">Avtomatik saqlash: Sozlamalar › Mijozlar kutubxonasi (yoki Telegram bot)</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => window.print()} aria-label="Chop etish yoki PDF saqlash"
              className="flex-1 py-3 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> Chop / PDF
            </button>
            <button onClick={onClose}
              className="flex-1 py-3 rounded-lg border-2 border-slate-200 font-medium text-slate-700 hover:bg-slate-50">
              Yopish
            </button>
          </div>
        </div>
      </div>

      {/* ===== EKRANDAN TASHQARI: DOIM NARXSIZ CHEK — albom rasmi shu yerdan olinadi =====
          MUHIM: siljish (left:-99999px) faqat TASHQI o'ramda. Suratga olinadigan
          ICHKI tugunda hech qanday position/offset yo'q — aks holda html-to-image
          kontentni SVG'dan tashqariga surib, OQ (bo'sh) rasm chiqaradi. */}
      {hasKaz && (
        <div aria-hidden="true"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', left: '-99999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>
          <div ref={dxfImgRef}
            style={{ width: '448px', background: '#ffffff', fontFamily: 'Georgia, serif' }}
            className="text-slate-900">
            <ReceiptBody order={order} shopName={shopName} shopPhone={shopPhone} narxsiz={true}
              statBadge={statBadge} olishUsd={olishUsd} sotishUsd={sotishUsd} kRows={kRows} ustaTel={ustaTel} />
          </div>
        </div>
      )}
    </div>
  );
}
