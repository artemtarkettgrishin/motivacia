import { Boxes, Tag } from 'lucide-react';
import type { PriceBlock, Promo, ShopExtra } from '@/lib/types';
import { buildPrintModel, buildPromoNotes, printShopLine, ROW_H_PT, type PrintSection } from '@/lib/printLayout';
import { isPercent, prettyPrice } from '@/lib/pricing';
import { resolveExtra } from '@/lib/extras';

export interface PrintDocProps {
  blocks: PriceBlock[];
  promos: Promo[];
  shop: string;
  price: string;
  company: string;
  date: string;
  extras: ShopExtra[];
}

const BORDER = '0.9pt solid #2b2b2b';
const BORDER_THICK = '1.4pt solid #000';

/**
 * Печать: A4 книжная, высота строки 14.4pt всегда, всё в одну строку (шрифт автоподбирается),
 * стиль приложения: золото/мята/красный, иконки секций, повтор шапки при переносе.
 */
export default function PrintDoc({ blocks, promos, shop, date, extras }: PrintDocProps) {
  const model = buildPrintModel({ blocks, promos });
  const headFont = Math.min(10.5, model.font);
  const promoNotes = buildPromoNotes(promos);

  return (
    <div className="print-doc">
      {/* ---- вверх: магазин + дата ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3mm', marginBottom: '1.6mm' }}>
        <div
          style={{
            width: '9mm', height: '9mm', borderRadius: '2mm', background: 'linear-gradient(135deg,#f9e7a8,#d4af37)',
            color: '#231a05', fontWeight: 800, fontSize: '13pt', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          М
        </div>
        <div style={{ fontSize: `${Math.min(headFont + 2.5, 13)}pt`, fontWeight: 800, color: '#000' }}>{shop}</div>
        <div style={{ marginLeft: 'auto', fontSize: `${headFont}pt`, color: '#5a5f5b', fontWeight: 600 }}>{printShopLine(shop, date)}</div>
      </div>
      <div style={{ height: '0.8mm', background: 'linear-gradient(90deg,#d4af37,#f9e7a8 40%,transparent)', borderRadius: '1mm', marginBottom: '2.2mm' }} />

      {model.sections.map((sec, i) => (
        <SectionTable key={i} sec={sec} />
      ))}

      {/* примечания к акциям — мелким шрифтом под таблицей, одной строкой каждое */}
      {promoNotes.length > 0 && (
        <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse', marginTop: '-1.2mm', marginBottom: '2.6mm', width: '100%' }}>
          <tbody>
            {promoNotes.map((t, i) => (
              <tr key={i} style={{ height: `${ROW_H_PT}pt`, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                <td style={{ border: BORDER, padding: '0 5px', height: `${ROW_H_PT}pt`, verticalAlign: 'middle', fontSize: `${Math.max(headFont - 1.6, 6)}pt`, fontStyle: 'italic', color: '#5a5f5b', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {t}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ---- вниз: плашки ---- */}
      {extras.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.6mm', marginTop: '1mm' }}>
          {extras.map((e, i) => {
            const st = resolveExtra(e);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '1.2mm', padding: `0.8mm 2.2mm`, borderRadius: '1.6mm',
                  background: `${st.hex}2e`, border: `0.9pt solid ${st.hex}`, color: '#000', fontSize: `${Math.max(headFont - 1, 6)}pt`, lineHeight: 1,
                }}
              >
                <st.Icon size={9} color={st.hex} strokeWidth={2.6} />
                <span style={{ color: '#5a5f5b', fontWeight: 600 }}>{e.label}:</span>
                <b style={{ color: st.hex }}>{e.value}</b>
              </span>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: '1.6mm', fontSize: '6.5pt', color: '#8a8f8b' }}>
        СтройМаркет · Мотивация · распечатано {printShopLine(shop, date).replace('прайс от ', '')}
      </div>
    </div>
  );
}

function SectionTable({ sec }: { sec: PrintSection }) {
  const { left, right, w, font } = sec;
  const n = Math.max(left.length, right.length);
  const fs = `${font}pt`;
  const cell: React.CSSProperties = { border: BORDER, padding: '0 4px', height: `${ROW_H_PT}pt`, verticalAlign: 'middle', lineHeight: 1, fontSize: fs };

  return (
    <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse', marginBottom: '2.6mm', width: '100%', breakInside: 'auto', pageBreakBefore: sec.kind === 'main' ? 'auto' : 'auto' }}>
      <colgroup>
        <col style={{ width: `${w.name}mm` }} />
        <col style={{ width: `${w.price}mm` }} />
        <col style={{ width: `${w.bonus}mm` }} />
        <col style={{ width: `${w.name}mm` }} />
        <col style={{ width: `${w.price}mm` }} />
        <col style={{ width: `${w.bonus}mm` }} />
      </colgroup>
      <thead>
        {sec.title && (
          <tr style={{ height: `${ROW_H_PT}pt`, breakAfter: 'avoid', pageBreakAfter: 'avoid' }}>
            <th
              colSpan={6}
              style={{
                height: `${ROW_H_PT}pt`, border: BORDER, borderBottom: BORDER_THICK, background: sec.bannerBg, textAlign: 'left',
                padding: '0 5px', fontSize: fs, fontWeight: 800, color: sec.bannerInk,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1.6mm' }}>
                {sec.icon === 'box' && <Boxes size={10} strokeWidth={2.6} />}
                {sec.icon === 'tag' && <Tag size={10} strokeWidth={2.6} />}
                {sec.title}
              </span>
            </th>
          </tr>
        )}
        <tr style={{ height: `${ROW_H_PT}pt`, breakAfter: 'avoid', pageBreakAfter: 'avoid' }}>
          {['Наименование', 'цена', 'бонус', 'Наименование', 'цена', 'бонус'].map((h, i) => (
            <th
              key={i}
              style={{
                height: `${ROW_H_PT}pt`, border: BORDER, borderBottom: BORDER_THICK, background: '#ffec32', color: '#000',
                fontSize: fs, fontWeight: 700, textAlign: i % 3 === 0 ? 'left' : 'center', padding: '0 5px',
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {n === 0 && (
          <tr style={{ height: `${ROW_H_PT}pt` }}>
            <td colSpan={6} style={{ ...cell, textAlign: 'center', color: '#7a7f7b' }}>—</td>
          </tr>
        )}
        {Array.from({ length: n }, (_, i) => {
          const a = left[i];
          const b = right[i];
          return (
            <tr key={i} style={{ height: `${ROW_H_PT}pt`, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <NameCell b={a?.b} font={font} cell={cell} />
              <PriceCell r={a} red={!!a?.b.isRed} font={font} cell={cell} />
              <BonusCell r={a} red={!!a?.b.isRed} font={font} cell={cell} />
              <NameCell b={b?.b} font={font} cell={{ ...cell, borderLeft: BORDER_THICK }} />
              <PriceCell r={b} red={!!b?.b.isRed} font={font} cell={cell} />
              <BonusCell r={b} red={!!b?.b.isRed} font={font} cell={cell} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function NameCell({ b, cell, font }: { b?: PriceBlock; font: number; cell: React.CSSProperties }) {
  void font;
  if (!b) return <td style={cell} />;
  return (
    <td style={{ ...cell, whiteSpace: 'nowrap', overflow: 'hidden', fontWeight: 700, color: b.isRed ? '#c4281b' : '#000' }}>
      {b.name}
    </td>
  );
}

function PriceCell({ r, red, cell, font }: { r?: { row: { price: string; bonus: string } }; red: boolean; font: number; cell: React.CSSProperties }) {
  void font;
  if (!r) return <td style={cell} />;
  return (
    <td style={{ ...cell, textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 600, color: red ? '#c4281b' : '#000', overflow: 'hidden' }}>
      {prettyPrice(r.row.price)}
    </td>
  );
}

function BonusCell({ r, red, cell, font }: { r?: { row: { price: string; bonus: string } }; red: boolean; font: number; cell: React.CSSProperties }) {
  void font;
  if (!r) return <td style={cell} />;
  const pct = isPercent(r.row.bonus);
  const bg = red ? '#fdeaed' : pct ? '#fdf5d7' : '#e9f6ef';
  const ink = red ? '#c4281b' : pct ? '#7a5b12' : '#0a7a54';
  return (
    <td style={{ ...cell, textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 700, background: bg, color: ink, overflow: 'hidden' }}>
      {r.row.bonus}
    </td>
  );
}
