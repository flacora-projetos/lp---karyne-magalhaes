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
import { MessageCircle, Clock } from 'lucide-react';
import type { Lead, StatusComercial, KanbanColumn } from './types';
import { KANBAN_COLUMNS, columnForStatus, ORIGEM_STYLE, ORIGEM_AVATAR } from './types';
import { timeAgo, initials, brl } from './format';

type Column = KanbanColumn & { accent: string };

interface KanbanBoardProps {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
  onMove: (leadId: string, status: StatusComercial) => void | Promise<void>;
}

const OrigemBadge: React.FC<{ origem: string | null }> = ({ origem }) => {
  if (!origem) return null;
  const cls = ORIGEM_STYLE[origem] ?? 'bg-[#E4DFD9] text-[#2B1B0A]/70';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${cls}`}>{origem}</span>;
};

// Conteúdo do card (compartilhado entre card arrastável e overlay).
// LGPD: nunca mostra comportamento_halito/uso_antibiotico aqui.
const CardBody: React.FC<{ lead: Lead; accent: string; dragging?: boolean }> = ({ lead, accent, dragging }) => {
  const avatarColor = (lead.origem && ORIGEM_AVATAR[lead.origem]) || '#8A94A6';
  const closed = lead.status_comercial === 'tratamento_fechado' && lead.valor_fechado != null;
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[#E4DFD9] bg-[#FEFEFE] pl-3.5 pr-3 py-2.5 ${
        dragging ? 'shadow-xl ring-2 ring-[#A95B21]/30 rotate-[1.5deg]' : 'shadow-sm hover:shadow-md hover:border-[#d8d0c6]'
      } transition-all`}
    >
      <span className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: accent }} />
      <div className="flex items-start gap-2.5">
        <div
          className="flex-none w-8 h-8 rounded-full grid place-items-center text-white text-[11px] font-semibold"
          style={{ backgroundColor: avatarColor }}
        >
          {initials(lead.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-medium text-[#2B1B0A] leading-tight truncate">{lead.nome || 'Lead sem nome'}</p>
            <OrigemBadge origem={lead.origem} />
          </div>
          <p className="text-[11px] text-[#2B1B0A]/45 truncate mt-0.5">
            {[lead.cidade, lead.estado].filter(Boolean).join('/') || 'Sem cidade'}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] text-[#565E48] font-medium truncate">
          <MessageCircle size={12} className="flex-none" /> {lead.whatsapp || '—'}
        </span>
        {closed ? (
          <span className="flex-none text-[11px] font-semibold text-[#222D19] bg-[#222D19]/10 rounded-full px-2 py-0.5">
            {brl(lead.valor_fechado)}
          </span>
        ) : (
          <span className="flex-none inline-flex items-center gap-1 text-[10px] text-[#2B1B0A]/40">
            <Clock size={10} /> {timeAgo(lead.criado_em)}
          </span>
        )}
      </div>
    </div>
  );
};

const DraggableCard: React.FC<{ lead: Lead; accent: string; onSelect: (l: Lead) => void }> = ({ lead, accent, onSelect }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.lead_id, data: { lead } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(lead)}
      className={`cursor-grab active:cursor-grabbing touch-none select-none ${isDragging ? 'opacity-40' : ''}`}
    >
      <CardBody lead={lead} accent={accent} />
    </div>
  );
};

const ColumnView: React.FC<{
  column: Column;
  leads: Lead[];
  onSelect: (l: Lead) => void;
  isActiveTarget: boolean;
}> = ({ column, leads, onSelect, isActiveTarget }) => {
  const isDropTarget = column.status !== null; // "Outros" não recebe drop
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: !isDropTarget });

  return (
    <div className="flex w-[270px] flex-none flex-col">
      {/* Cabeçalho congelado: fica visível ao rolar os cartões */}
      <div className="sticky top-0 z-10 bg-[#F6F0E9] flex items-center justify-between px-1.5 pt-0.5 pb-2">
        <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#3a3227]">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: column.accent }} />
          {column.label}
        </span>
        <span className="text-[11px] font-semibold text-[#2B1B0A]/50 bg-white/70 border border-[#E4DFD9] rounded-full min-w-[22px] text-center px-1.5 py-0.5">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[140px] rounded-2xl border p-2 space-y-2 transition-colors ${
          isDropTarget
            ? isOver && isActiveTarget
              ? 'border-[#A95B21] border-2 bg-[#A95B21]/[0.06]'
              : 'border-[#E4DFD9] bg-[#EFE7DD]/50'
            : 'border-dashed border-[#D8D0C6] bg-[#EFE7DD]/25'
        }`}
      >
        {leads.length === 0 && (
          <p className="text-[11px] text-[#2B1B0A]/30 text-center py-8">
            {isDropTarget ? 'Arraste um lead para cá' : 'Defina pelo detalhe do lead'}
          </p>
        )}
        {leads.map((l) => (
          <DraggableCard key={l.lead_id} lead={l} accent={column.accent} onSelect={onSelect} />
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

  const activeAccent = activeLead ? columnForStatus(activeLead.status_comercial).accent : '#A95B21';

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
      <div className="h-full overflow-auto pb-1 -mx-1 px-1">
        <div className="flex gap-3 min-w-max items-stretch">
          {KANBAN_COLUMNS.map((c) => (
            <ColumnView key={c.id} column={c} leads={byColumn[c.id]} onSelect={onSelect} isActiveTarget={!!activeLead} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeLead ? (
          <div className="w-[254px]">
            <CardBody lead={activeLead} accent={activeAccent} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
