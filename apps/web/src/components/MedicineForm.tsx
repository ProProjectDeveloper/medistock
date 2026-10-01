import { useState } from 'react';
import { saveMedicine, type Medicine } from '@medistock/core';
import { useData } from '../lib/store';
import { Button, Input, Modal, Select } from './ui';

type Draft = Omit<Medicine, 'id' | 'createdAt'> & { id?: string; createdAt?: string };

export function MedicineForm({ open, onClose, medicine, onSaved }: { open: boolean; onClose: () => void; medicine?: Medicine; onSaved?: (id: string) => void }) {
  const { ds, run } = useData();
  const blank: Draft = {
    name: '', genericName: '', strength: '', form: 'Tablet', packSize: 10, category: '', barcode: '', storage: 'room', schedule: 'otc',
    reorderLevel: ds.settings.defaultReorderLevel, locationId: ds.locations[0]?.id ?? null, isActive: true,
  };
  const [d, setD] = useState<Draft>(medicine ?? blank);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const categories = [...new Set(ds.medicines.map((m) => m.category))].sort();

  const save = async () => {
    if (!d.name.trim()) return setErr('Name is required.');
    if (d.barcode && ds.medicines.some((m) => m.barcode === d.barcode && m.id !== d.id)) return setErr('Another medicine already uses this barcode.');
    let savedId = d.id;
    const ok = await run(() => {
      const cs = saveMedicine(d);
      savedId = cs.medicines![0].id;
      return cs;
    }, medicine ? 'Medicine updated.' : 'Medicine added.');
    if (ok) { onClose(); if (savedId) onSaved?.(savedId); }
  };

  return (
    <Modal open={open} onClose={onClose} title={medicine ? `Edit ${medicine.name}` : 'Add medicine'} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{medicine ? 'Save changes' : 'Add medicine'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Brand name" value={d.name} onChange={(e) => set('name', e.target.value)} error={err} />
        <Input label="Generic name" value={d.genericName} onChange={(e) => set('genericName', e.target.value)} />
        <Input label="Strength" value={d.strength} onChange={(e) => set('strength', e.target.value)} placeholder="500 mg" />
        <Input label="Dosage form" value={d.form} onChange={(e) => set('form', e.target.value)} />
        <Input label="Pack size (units)" type="number" min={1} mono value={d.packSize} onChange={(e) => set('packSize', Number(e.target.value))} />
        <Input label="Category" list="categories" value={d.category} onChange={(e) => set('category', e.target.value)} />
        <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <Input label="Barcode (GTIN/EAN)" mono value={d.barcode} onChange={(e) => set('barcode', e.target.value)} help="Scan into this field" />
        <Input label="Reorder level (units)" type="number" min={0} mono value={d.reorderLevel} onChange={(e) => set('reorderLevel', Number(e.target.value))} />
        <Select label="Storage" value={d.storage} onChange={(e) => set('storage', e.target.value as Draft['storage'])}>
          <option value="room">Room temperature</option><option value="cold">Cold chain 2–8 °C</option><option value="controlled">Controlled</option>
        </Select>
        <Select label="Schedule" value={d.schedule} onChange={(e) => set('schedule', e.target.value as Draft['schedule'])}>
          <option value="otc">OTC</option><option value="rx">Rx</option><option value="controlled">Controlled</option>
        </Select>
        <Select label="Shelf location" value={d.locationId ?? ''} onChange={(e) => set('locationId', e.target.value || null)}>
          <option value="">Not set</option>
          {ds.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
      </div>
    </Modal>
  );
}
