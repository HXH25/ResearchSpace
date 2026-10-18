import { useId, type KeyboardEvent } from 'react';

export function Tabs<T extends string>({items, value, onChange, label}: {items: {id: T; label: string}[]; value: T; onChange: (id: T) => void; label: string}) {
  const prefix = useId();
  function key(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault(); onChange(items[next].id);
    document.getElementById(`${prefix}-${items[next].id}`)?.focus();
  }
  return <div className="rs-tabs" role="tablist" aria-label={label}>{items.map((item, i) => <button type="button" role="tab" id={`${prefix}-${item.id}`} key={item.id} aria-selected={value === item.id} tabIndex={value === item.id ? 0 : -1} onKeyDown={e => key(e, i)} onClick={() => onChange(item.id)}>{item.label}</button>)}</div>;
}
