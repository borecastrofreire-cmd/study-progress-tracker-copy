import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { createConversation, createAgentChat } from '@/lib/agent-chat/v2';
import type { UIMessage } from 'ai';

// Manual type guard since isToolUIPart may not be exported in this version
function isToolPart(part: UIMessage['parts'][number]): part is UIMessage['parts'][number] & { type: 'tool'; toolName: string; state: string; approval?: { id: string } } {
  return part.type === 'tool';
}
import { ulid } from 'ulidx';
import { Loader2, Sparkles, X, Bot, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

const AGENT_ID = '01KJCXV999WQF8FZJBV1SYCK55';
const CONVO_STORAGE_KEY = 'study_tracker_chat_conversation_id';

const STARTERS = [
  '¿Cuántas páginas me quedan?',
  'Resume mi progreso',
  '¿Qué estudio hoy?',
];

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const [chat, setChat] = useState<ReturnType<typeof createAgentChat> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        let convoId = sessionStorage.getItem(CONVO_STORAGE_KEY);
        if (!convoId) {
          const res = await createConversation(AGENT_ID);
          convoId = res.conversationId;
          sessionStorage.setItem(CONVO_STORAGE_KEY, convoId);
        }
        if (active) {
          setChat(createAgentChat(AGENT_ID, convoId));
        }
      } catch (err) {
        console.error('Error starting conversation:', err);
        toast.error('Error al conectar con el asistente');
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, []);

  if (loading || !chat) {
    return (
      <div className="flex flex-col h-full w-full bg-white border-l border-[#e5e5ea] items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-[#007aff] animate-spin" />
        <p className="text-xs text-[#8e8e93] font-medium">Conectando con el asistente...</p>
      </div>
    );
  }

  return <ActiveChat chat={chat} onClose={onClose} />;
}

function ActiveChat({
  chat,
  onClose,
}: {
  chat: ReturnType<typeof createAgentChat>;
  onClose: () => void;
}) {
  const { messages, status, addToolApprovalResponse } = useChat({ chat, id: chat.id });
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const isSending = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput('');
    try {
      await chat.sendMessage({
        id: ulid(),
        role: 'user',
        parts: [{ type: 'text', text: trimmed }],
      });
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Error al enviar el mensaje');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full w-full bg-white border-l border-[#e5e5ea]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#e5e5ea] bg-white flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-[#f2f2f7] border border-[#e5e5ea] flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-[#007aff]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#1c1c1e]">Asistente de Estudio</p>
          <p className="text-xs text-[#8e8e93]">Pregúntame cualquier cosa</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f2f2f7] text-[#8e8e93] hover:text-[#1c1c1e] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-[#e5e5ea] scrollbar-track-transparent">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#f2f2f7] border border-[#e5e5ea] flex items-center justify-center">
              <Bot className="w-5 h-5 text-[#007aff]" />
            </div>
            <div>
              <p className="text-sm text-[#8e8e93] mb-3">¿En qué puedo ayudarte?</p>
              <div className="flex flex-col gap-1.5">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="text-xs px-3 py-2 rounded-xl bg-[#f2f2f7] border border-[#e5e5ea] text-[#1c1c1e] hover:bg-[#e5e5ea] transition-all text-left font-medium"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onApprove={addToolApprovalResponse}
          />
        ))}

        {isSending && (() => {
          const last = messages[messages.length - 1];
          const streaming = last?.role === 'assistant' &&
            last.parts.some(p => p.type === 'text' && p.text.length > 0);
          return !streaming;
        })() && (
          <div className="flex justify-start">
            <div className="bg-[#f2f2f7] border border-[#e5e5ea] rounded-2xl rounded-bl-sm px-3.5 py-2.5">
              <Loader2 className="w-4 h-4 text-[#8e8e93] animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#e5e5ea] flex-shrink-0">
        <div className="flex items-end gap-2 bg-[#f2f2f7] border border-[#e5e5ea] rounded-xl p-2 focus-within:border-[#aeaeb2] transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-[#1c1c1e] placeholder-[#aeaeb2] resize-none focus:outline-none leading-relaxed max-h-24 overflow-y-auto"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isSending}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#007aff] hover:bg-[#1a8aff] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
        <p className="text-xs text-[#aeaeb2] mt-1.5 text-center font-medium">Enter para enviar</p>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onApprove,
}: {
  message: UIMessage;
  onApprove: ReturnType<typeof useChat>['addToolApprovalResponse'];
}) {
  return (
    <>
      {message.parts.map((part, i) => {
        const key = `${message.id}-${i}`;

        if (part.type === 'text') {
          if (!part.text) return null;
          return (
            <div
              key={key}
              className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                  message.role === 'user'
                    ? 'bg-[#007aff] text-white rounded-br-sm'
                    : 'bg-[#f2f2f7] border border-[#e5e5ea] text-[#1c1c1e] rounded-bl-sm'
                )}
              >
                {message.role === 'assistant' ? (
                  <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:text-[#1c1c1e] prose-strong:text-[#1c1c1e] text-[#1c1c1e]">
                    {part.text}
                  </ReactMarkdown>
                ) : (
                  <span className="whitespace-pre-wrap">{part.text}</span>
                )}
              </div>
            </div>
          );
        }

        if (isToolPart(part)) {
          return (
            <div key={key} className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs bg-[#f2f2f7] border border-[#e5e5ea] rounded-bl-sm">
                <p className="font-medium text-[#1c1c1e] mb-1">
                  🔧 {part.toolName}
                </p>
                <p className="text-[#8e8e93]">
                  {part.state === 'input-available' && '⏳ Ejecutando...'}
                  {part.state === 'input-streaming' && '⏳ Preparando...'}
                  {part.state === 'output-available' && '✅ Completado'}
                  {part.state === 'output-error' && '❌ Error'}
                  {part.state === 'output-denied' && '🚫 Denegado'}
                  {part.state === 'approval-requested' && '⚠️ Requiere aprobación'}
                  {part.state === 'approval-responded' && '✅ Respondido'}
                </p>
                {part.state === 'approval-requested' && part.approval != null && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => onApprove({ id: part.approval!.id, approved: true })}
                      className="px-3 py-1.5 rounded-lg bg-[#34c759] text-white text-xs font-medium hover:bg-[#2db84e] transition-colors"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => onApprove({ id: part.approval!.id, approved: false })}
                      className="px-3 py-1.5 rounded-lg bg-[#ff3b30] text-white text-xs font-medium hover:bg-[#e0342b] transition-colors"
                    >
                      Denegar
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        }

        return null;
      })}
    </>
  );
}
