"use client";

import { useState } from "react";

export type AccordionItem = { id: string; title: string; body: React.ReactNode };

export function Accordion({ items, defaultOpenId }: { items: AccordionItem[]; defaultOpenId?: string }) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? items[0]?.id ?? null);
  return (
    <div className="zad-accordion">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <div key={item.id} className="zad-accordion__item">
            <button
              type="button"
              className="zad-accordion__trigger"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : item.id)}
            >
              <span>{item.title}</span>
              <span aria-hidden>{open ? "▾" : "◂"}</span>
            </button>
            {open ? <div className="zad-accordion__panel">{item.body}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
