import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";

export function SortableTableRow({
  id,
  children,
  disabled,
  className,
  onRowClick,
  "data-testid": dataTestId,
}: {
  id: string | number;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onRowClick?: () => void;
  "data-testid"?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={className}
      data-testid={dataTestId}
      onRowClick={onRowClick}
    >
      <TableCell className={disabled ? "" : "cursor-grab"}>
        {!disabled && (
          <span {...attributes} {...listeners}>
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </span>
        )}
      </TableCell>
      {children}
    </TableRow>
  );
}

export function SortableContext_Wrapper({
  items,
  onReorder,
  children,
}: {
  items: { id: number | string }[];
  onReorder: (items: { id: number | string; sortOrder: number }[]) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    onReorder(reordered.map((item, index) => ({ id: item.id, sortOrder: index })));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
