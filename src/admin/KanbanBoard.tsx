import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Lead, StatusComercial, KanbanColumn } from './types';
import { KANBAN_COLUMNS, columnForStatus, ORIGEM_STYLE } from './types';
import { dateShort } from './format';

interface KanbanBoardProps {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
  onMove: (leadId: string, status: StatusComercial) => void | Promise<void>;
}

const OrigemBadge: React.FC<{ origem: string | null }> = ({ origem }) => {
  if (!origem) return null;
  const cls = ORIGEM_STYLE[origem] ?? 'bg-[#E4DFD9] text-[#2B1B0A]/70';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{origem}</span>;
};

// Conteúdo do card (compartilhado entre card arrastável e overlay).
// LGPD: nunca mostra comportamento_halito/uso_antibiotico aqui.
const CardBody: React.FC<{ lead: Lead; dragging?: boolean }> = ({ lead, dragging }) => (
  <div
    className={`rounded-xl border border-[#E4DFD9] bg-[#FEFEFE] p-3 shadow-sm ${
      dragging ? 'shadow-lg ring-2 ring-[#A95B21]/30' : ''
    }`}
  >
    <div className="flex items-start justify-between gap-2">
      <p className="text-[13px] font-medium text-[#2B1B0A] leading-tight truncate">{lead.nome || 'Lead sem nome'}</p>
      <OrigemBadge origem={lead.origem} />
    </div>
    <p className="text-[12px] text-[#2B1B0A]/70 mt-1">{lead.whatsapp || '—'}</p>
    <p className="text-[11px] text-[#2B1B0A]/45 mt-1.5">{dateShort(lead.criado_em)}</p>
  </div>
);

const DraggableCard: React.FC<{ lead: Lead; onSelect: (l: Lead) => void }> = ({ lead, onSelect }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.lead_id, data: { lead } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(lead)}
      className={`cursor-grab active:cursor-grabbing touch-none select-none ${isDragging ? 'opacity-40' : ''}`}
    >
      <CardBody lead={lead} />
    </div>
  );
};

const Column: React.FC<{
  column: KanbanColumn;
  leads: Lead[];
  onSelect: (l: Lead) => void;
  isActiveTarget: boolean;
}> = ({ column, leads, onSelect, isActiveTarget }) => {
  const isDropTarget = column.status !== null; // "Outros" não recebe drop
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: !isDropTarget });

  return (
    <div className="flex w-[264px] flex-none flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[#565E48]">{column.label}</span>
        <span className="text-[11px] font-medium text-[#2B1B0A]/45 bg-[#E4DFD9]/60 rounded-full px-2 py-0.5">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-2xl border p-2 space-y-2 transition-colors ${
          isDropTarget
            ? isOver && isActiveTarget
              ? 'border-[#A95B21] bg-[#A95B21]/5'
              : 'border-[#E4DFD9] bg-[#F6F0E9]/50'
            : 'border-dashed border-[#E4DFD9] bg-[#F6F0E9]/30'
        }`}
      >
        {leads.length === 0 && (
          <p className="text-[11px] text-[#2B1B0A]/30 text-center py-6">
            {isDropTarget ? 'Arraste um lead para cá' : 'Defina pelo detalhe do lead'}
          </p>
        )}
        {leads.map((l) => (
          <DraggableCard key={l.lead_id} lead={l} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ leads, onSelect, onMove }) => {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Delay no toque: permite rolar a tela no tablet sem iniciar arraste.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const byColumn = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    KANBAN_COLUMNS.forEach((c) => (map[c.id] = []));
    for (const l of leads) {
      const col = columnForStatus(l.status_comercial);
      map[col.id].push(l);
    }
    return map;
  }, [leads]);

  const handleDragStart = (e: DragStartEvent) => {
    const lead = (e.active.data.current as { lead?: Lead } | undefined)?.lead ?? null;
    setActiveLead(lead);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = e;
    if (!over) return;
    const column = KANBAN_COLUMNS.find((c) => c.id === over.id);
    if (!column || column.status === null) return; // "Outros" não é alvo
    const lead = (active.data.current as { lead?: Lead } | undefined)?.lead;
    if (!lead || lead.status_comercial === column.status) return;
    onMove(lead.lead_id, column.status);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveLead(null)}
    >
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {KANBAN_COLUMNS.map((c) => (
            <Column key={c.id} column={c} leads={byColumn[c.id]} onSelect={onSelect} isActiveTarget={!!activeLead} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeLead ? (
          <div className="w-[248px]">
            <CardBody lead={activeLead} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
