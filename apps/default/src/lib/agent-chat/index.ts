/**
 * Agent Chat SDK for Taskade Genesis
 *
 * Low-level SDK for building AI Agent Chat interfaces in React applications.
 * Provides API client, SSE stream management, and optional React hooks.
 *
 * @example
 * ```typescript
 * // Low-level usage (no React)
 * import { createConversation, sendMessage, AgentChatStream } from '@/lib/agent-chat';
 *
 * // Create conversation manually
 * const { conversationId } = await createConversation(agentId);
 * const stream = new AgentChatStream(agentId, conversationId);
 * stream.on('text-delta', ({ id, delta }) => {
 *   // Handle text updates
 * });
 * stream.connect();
 * await sendMessage(agentId, conversationId, 'Hello!');
 * ```
 *
 * @example
 * ```typescript
 * // React hook usage
 * import { useAgentChat, createConversation } from '@/lib/agent-chat';
 * import { useState } from 'react';
 *
 * function ChatComponent() {
 *   const [conversationId, setConversationId] = useState<string | null>(null);
 *   const { sendMessage, messages, isConnected } = useAgentChat(agentId, conversationId);
 *
 *   // Create conversation manually
 *   const handleStartChat = async () => {
 *     const { conversationId: newId } = await createConversation(agentId);
 *     setConversationId(newId);
 *   };
 *
 *   return (
 *     <div>
 *       {!conversationId && <button onClick={handleStartChat}>Start Chat</button>}
 *       {messages.map(msg => (
 *         <div key={msg.id}>
 *           {msg.role === 'user' ? 'You: ' : 'Agent: '}
 *           {msg.content}
 *           {msg.toolCalls && msg.toolCalls.length > 0 && (
 *             <div>Tool calls: {msg.toolCalls.length}</div>
 *           )}
 *         </div>
 *       ))}
 *       <button onClick={() => sendMessage('Hello!')}>Send</button>
 *     </div>
 *   );
 * }
 * ```
 */

// Core API client (for advanced usage)
export type { ClientOptions } from './client';
export { createConversation, sendMessage } from './client';

// Stream manager (for advanced usage)
export { AgentChatStream } from './stream';

// Types
export type {
  CreateConversationResponse,
  ErrorEvent,
  ErrorHandler,
  FinishEvent,
  FinishHandler,
  MessageState,
  SendMessageResponse,
  StartEvent,
  StreamEvent,
  StreamEventHandler,
  StreamOptions,
  TextDeltaEvent,
  TextDeltaHandler,
  TextEndEvent,
  TextStartEvent,
  ToolCallEndEvent,
  ToolCallState,
  ToolInputAvailableEvent,
  ToolInputDeltaEvent,
  ToolInputStartEvent,
  ToolOutputAvailableEvent,
} from './types';

// React hook (main API)
export type { UseAgentChatOptions, UseAgentChatReturn } from './hooks';
export { useAgentChat } from './hooks';
