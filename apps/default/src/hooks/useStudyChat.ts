import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

const AGENT_ID = '01KJCXV999WQF8FZJBV1SYCK55';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export function useStudyChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const currentMsgIdRef = useRef<string | null>(null);

  const connect = useCallback(async (convoId: string) => {
    if (esRef.current) esRef.current.close();
    const url = `/api/taskade/agents/${AGENT_ID}/public-conversations/${convoId}/stream`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setIsConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'start') {
          currentMsgIdRef.current = data.messageId;
          setMessages((prev) => [
            ...prev,
            { id: data.messageId, role: 'assistant', content: '', streaming: true },
          ]);
          setIsLoading(false);
        } else if (data.type === 'text-delta') {
          const mid = currentMsgIdRef.current;
          if (!mid) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === mid ? { ...m, content: m.content + data.delta } : m
            )
          );
        } else if (data.type === 'finish') {
          const mid = currentMsgIdRef.current;
          if (mid) {
            setMessages((prev) =>
              prev.map((m) => (m.id === mid ? { ...m, streaming: false } : m))
            );
          }
          currentMsgIdRef.current = null;
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setIsConnected(false);
    };
  }, []);

  const startConversation = useCallback(async () => {
    const res = await axios.post(
      `/api/taskade/agents/${AGENT_ID}/public-conversations`
    );
    const convoId = res.data.conversationId;
    setConversationId(convoId);
    await connect(convoId);
    return convoId;
  }, [connect]);

  const send = useCallback(
    async (text: string) => {
      let convoId = conversationId;
      if (!convoId) {
        convoId = await startConversation();
      }
      const userMsgId = `user-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: 'user', content: text },
      ]);
      setIsLoading(true);
      await axios.post(
        `/api/taskade/agents/${AGENT_ID}/public-conversations/${convoId}/messages`,
        { text }
      );
    },
    [conversationId, startConversation]
  );

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  return { messages, send, isConnected, isLoading, conversationId };
}
