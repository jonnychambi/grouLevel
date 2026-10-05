import type { ComponentProps } from 'react';
import { Modal } from '../ui/Modal';
import { FilterPanel } from './FilterPanel';

/** Filtros en drawer (mobile / tablet). Los cambios se aplican en vivo. */
export function FilterDrawer({ open, onClose, total, ...props }: ComponentProps<typeof FilterPanel> & { open: boolean; onClose: () => void; total: number }) {
  return (
    <Modal open={open} onClose={onClose} title="Filtrar programas" variant="drawer">
      <div className="flex min-h-full flex-col">
        <div className="flex-1 px-5 py-4">
          <FilterPanel {...props} />
        </div>
        <div className="sticky bottom-0 border-t border-line bg-midnight p-4">
          <button className="btn btn-primary w-full" onClick={onClose}>
            Ver {total} {total === 1 ? 'programa' : 'programas'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
