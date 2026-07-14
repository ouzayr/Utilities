import { useState } from 'react';

export function CarryDialog({
  title,
  defaultDate,
  onCancel,
  onConfirm,
}: {
  title: string;
  defaultDate: string;
  onCancel: () => void;
  onConfirm: (date: string) => void;
}) {
  const [date, setDate] = useState(defaultDate);
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="dialog-actions">
          <button className="chip" onClick={onCancel}>Cancel</button>
          <button className="chip primary" onClick={() => date && onConfirm(date)}>OK</button>
        </div>
      </div>
    </div>
  );
}
