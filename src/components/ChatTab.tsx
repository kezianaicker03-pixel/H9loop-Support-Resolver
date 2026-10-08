import React, { useState } from 'react';
import { ChatMessage, CaseState, DecisionRecord } from '../types.js';
import { Send, User, Bot, Check, AlertCircle, Copy, Sparkles, RefreshCcw } from 'lucide-react';
import { AgentActivityPanel } from './AgentActivityPanel.js';

interface ChatTabProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  caseState: CaseState;
  onResetChat: () => void;
  latestDecision?: DecisionRecord;
  latestToolCalls?: {
    tool_name: string;
    inputs: any;
    output: any;
  }[];
}

export const ChatTab: React.FC<ChatTabProps> = ({
  messages,
  onSendMessage,
  isLoading,
  caseState,
  onResetChat,
  latestDecision,
  latestToolCalls,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const msg = inputText;
    setInputText('');
    onSendMessage(msg);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quick Preset Scenarios for instantaneous classroom verification
  const quickPresets = [
    {
      label: 'S1: Eligible Refund',
      text: 'Hello, I want a refund for order H9-10159. My email is palesa.naidoo1@example.com and phone ends in 7500.',
    },
    {
      label: 'S4: Duplicate Charge',
      text: 'I was charged twice for order H9-10162! Please refund the duplicate. Email tendai.mokoena4@example.com, phone 2408.',
    },
    {
      label: 'S7: Fraud-Flagged',
      text: 'I need a refund for order H9-10165. My email is thabo.sithole7@example.com, phone 8115.',
    },
    {
      label: 'S10: Missing Access',
      text: 'I paid for course order H9-10168 but I have no access to materials! Email sibusiso.williams10@example.com, phone 6695.',
    },
    {
      label: 'S11: Partial Refund',
      text: 'Can I get a partial refund of R3,000 for order H9-10169? Email lerato.pillay11@example.com, phone 6617.',
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Chat Column (7 cols) */}
      <div className="lg:col-span-7 flex flex-col h-[750px] bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {/* Chat Header */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-semibold text-slate-800">Customer Support Channel</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-mono">Isolated Session</span>
          </div>
          <button
            onClick={onResetChat}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded transition-colors"
          >
            <RefreshCcw className="w-3 h-3" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Quick Test Case Presets */}
        <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs">
          <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap pl-1">Quick Load:</span>
          {quickPresets.map((preset, i) => (
            <button
              key={i}
              onClick={() => onSendMessage(preset.text)}
              disabled={isLoading}
              className="px-2 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 rounded text-[11px] font-medium whitespace-nowrap transition-colors disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => {
            const isAgent = m.sender === 'agent';
            const wordCount = m.text.trim().split(/\s+/).length;

            return (
              <div
                key={m.id}
                className={`flex gap-3 max-w-[88%] ${isAgent ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
              >
                <div
                  className={`w-7 h-7 rounded flex items-center justify-center shrink-0 text-xs font-bold ${
                    isAgent
                      ? 'bg-slate-900 text-white'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  {isAgent ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                <div className="flex flex-col gap-1">
                  <div
                    className={`p-3 rounded-lg text-xs leading-relaxed ${
                      isAgent
                        ? 'bg-slate-100 text-slate-900 border border-slate-200'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>

                    {/* Interactive Refund Confirmation Card (Section 8 APPROVE step) */}
                    {isAgent && m.decision?.action === 'confirm_refund' && (
                      <div className="mt-3 p-2.5 bg-white border border-indigo-200 rounded text-slate-800 text-xs">
                        <div className="font-semibold text-indigo-950 mb-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Explicit Refund Confirmation Required (Rule G4)</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mb-2">
                          Click below to confirm, or reply in chat.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onSendMessage('Yes, I confirm that I want to proceed with this refund.')}
                            disabled={isLoading}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded transition-colors"
                          >
                            Yes, Confirm Refund
                          </button>
                          <button
                            onClick={() => onSendMessage('No, cancel this refund.')}
                            disabled={isLoading}
                            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metadata line */}
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1">
                    <span>{m.timestamp}</span>
                    {isAgent && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className={wordCount <= 120 ? 'text-slate-500' : 'text-rose-600 font-bold'}>
                          {wordCount} words (G9 limit: 120)
                        </span>
                      </>
                    )}
                    <button
                      onClick={() => handleCopy(m.id, m.text)}
                      className="hover:text-slate-600 transition-colors"
                      title="Copy message"
                    >
                      {copiedId === m.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 max-w-[88%] mr-auto">
              <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 rounded-lg text-xs bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                <span>Executing orchestration loop & policy verification...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-200 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            placeholder={
              !caseState.verified
                ? 'Enter your query, registered email, and phone last 4 digits...'
                : 'Type your message (or reply "yes" to confirm refund)...'
            }
            className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>

      {/* Right Activity Column (5 cols) */}
      <div className="lg:col-span-5">
        <AgentActivityPanel
          caseState={caseState}
          latestDecision={latestDecision}
          latestToolCalls={latestToolCalls}
        />
      </div>
    </div>
  );
};
