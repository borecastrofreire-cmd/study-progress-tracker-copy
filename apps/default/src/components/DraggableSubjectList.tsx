import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { SubjectCard } from './SubjectCard';
import type { Subject, SubjectColor } from '../types/study';

interface Props {
  subjects: Subject[];
  onReorder: (result: DropResult) => void;
  onUpdate: () => void;
  onPatch: (id: string, patch: { color?: SubjectColor; emoji?: string; text?: string }) => void;
  onDelete: (id: string) => void;
}

export function DraggableSubjectList({ subjects, onReorder, onUpdate, onPatch, onDelete }: Props) {
  return (
    <DragDropContext onDragEnd={onReorder}>
      <Droppable droppableId="subjects-list">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="space-y-4"
          >
            {subjects.map((subject, index) => (
              <Draggable key={subject.id} draggableId={subject.id} index={index}>
                {(drag, snapshot) => (
                  <div
                    ref={drag.innerRef}
                    {...drag.draggableProps}
                    style={{
                      ...drag.draggableProps.style,
                      // Smooth deceleration when dropped
                      transition: snapshot.isDropAnimating
                        ? 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)'
                        : drag.draggableProps.style?.transition,
                    }}
                  >
                    <SubjectCard
                      subject={subject}
                      index={index}
                      onUpdate={onUpdate}
                      onPatch={onPatch}
                      onDelete={onDelete}
                      dragHandleProps={drag.dragHandleProps}
                      isDragging={snapshot.isDragging}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
