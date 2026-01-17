import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useTelegram } from '../contexts/TelegramContext';
import { useGame } from '../contexts/GameContext';
import { MessageCircle, Send, X, ChevronUp, Reply, Trash2, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from './ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Character images for avatars
const CHARACTER_IMAGES = {
  max: "https://customer-assets.emergentagent.com/job_doge-treats/artifacts/2ug7a85m_tappy%20%287%29.png",
  rex: "https://customer-assets.emergentagent.com/job_doge-treats/artifacts/5zp4u53e_tappy%20%2814%29.png",
  luna: "https://customer-assets.emergentagent.com/job_doge-treats/artifacts/c6n8bfks_tappy%20%2813%29.png",
};

const ScientistChat = () => {
  const { address } = useAccount();
  const { telegramUser } = useTelegram();
  const { user } = useGame();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const lastMessageIdRef = useRef(null);

  const playerAddress = address || (telegramUser ? `tg_${telegramUser.id}` : null);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!API_URL) return;
    
    try {
      const response = await fetch(`${API_URL}/api/chat/messages?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        
        // Track unread if chat is closed
        if (!isOpen && data.length > 0) {
          const lastId = data[data.length - 1]?.id;
          if (lastMessageIdRef.current && lastId !== lastMessageIdRef.current) {
            setUnreadCount(prev => prev + 1);
          }
          lastMessageIdRef.current = lastId;
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [isOpen]);

  // Initial fetch and polling
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Clear unread when opening chat
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      if (messages.length > 0) {
        lastMessageIdRef.current = messages[messages.length - 1]?.id;
      }
    }
  }, [isOpen, messages]);

  // Scroll to bottom when new messages
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !playerAddress || sending) return;
    
    setSending(true);
    try {
      const response = await fetch(`${API_URL}/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_address: playerAddress,
          content: newMessage.trim(),
          reply_to: replyingTo?.id || null
        })
      });
      
      if (response.ok) {
        setNewMessage('');
        setReplyingTo(null);
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  // Upvote message
  const handleUpvote = async (messageId) => {
    if (!playerAddress) return;
    
    try {
      const response = await fetch(`${API_URL}/api/chat/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          voter_address: playerAddress
        })
      });
      
      if (response.ok) {
        fetchMessages();
      }
    } catch (error) {
      console.error('Error upvoting:', error);
    }
  };

  // Delete message
  const handleDelete = async (messageId) => {
    if (!playerAddress) return;
    
    try {
      const response = await fetch(`${API_URL}/api/chat/messages/${messageId}?sender_address=${playerAddress}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchMessages();
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Closed state - floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg flex items-center justify-center hover:scale-110 transition-transform border-2 border-white/20"
        data-testid="chat-open-btn"
      >
        <MessageCircle className="w-6 h-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 z-50 bg-black/80 backdrop-blur-xl rounded-full px-4 py-2 flex items-center gap-2 border border-emerald-500/30">
        <MessageCircle className="w-4 h-4 text-emerald-400" />
        <span className="text-white text-sm font-semibold">Lab Chat</span>
        <button onClick={() => setIsMinimized(false)} className="p-1 hover:bg-white/10 rounded">
          <Maximize2 className="w-4 h-4 text-white" />
        </button>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded">
          <X className="w-4 h-4 text-white" />
        </button>
      </div>
    );
  }

  // Full chat view
  return (
    <div 
      className="fixed bottom-4 left-4 z-50 w-80 sm:w-96 h-[70vh] max-h-[500px] bg-black/80 backdrop-blur-xl rounded-2xl border border-emerald-500/30 shadow-2xl flex flex-col overflow-hidden"
      data-testid="scientist-chat"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-600/30 to-teal-600/30 border-b border-emerald-500/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Lab Chat</h3>
            <p className="text-emerald-300 text-[10px]">{messages.length} messages • Scientists online</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized(true)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
            <Minimize2 className="w-4 h-4 text-white/70" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-emerald-500/30">
        {messages.length === 0 ? (
          <div className="text-center text-white/50 text-sm py-8">
            No messages yet. Start the conversation! 🧪
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_address === playerAddress;
            const hasUpvoted = msg.upvotes?.includes(playerAddress);
            
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] ${isOwn ? 'order-2' : 'order-1'}`}>
                  {/* Reply preview */}
                  {msg.reply_preview && (
                    <div className="text-[10px] text-emerald-400/70 mb-0.5 px-2 border-l-2 border-emerald-500/50 truncate">
                      ↩ {msg.reply_preview}
                    </div>
                  )}
                  
                  <div className={`rounded-2xl px-3 py-2 ${
                    isOwn 
                      ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-br-sm' 
                      : 'bg-white/10 text-white rounded-bl-sm'
                  }`}>
                    {/* Sender info */}
                    {!isOwn && (
                      <div className="flex items-center gap-1.5 mb-1">
                        {msg.sender_character && CHARACTER_IMAGES[msg.sender_character] ? (
                          <img 
                            src={CHARACTER_IMAGES[msg.sender_character]} 
                            alt="" 
                            className="w-4 h-4 rounded-full"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-emerald-500/50" />
                        )}
                        <span className="text-[10px] text-emerald-300 font-semibold truncate max-w-[100px]">
                          {msg.sender_nickname || 'Scientist'}
                        </span>
                      </div>
                    )}
                    
                    {/* Message content */}
                    <p className="text-sm break-words">{msg.content}</p>
                    
                    {/* Footer */}
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span className="text-[9px] opacity-60">{formatTime(msg.created_at)}</span>
                      
                      <div className="flex items-center gap-1">
                        {/* Upvote button */}
                        <button
                          onClick={() => handleUpvote(msg.id)}
                          disabled={isOwn}
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                            hasUpvoted 
                              ? 'bg-yellow-500/30 text-yellow-300' 
                              : 'hover:bg-white/10 text-white/60'
                          } ${isOwn ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={isOwn ? "Can't upvote own message" : "Upvote (+1 XP to author)"}
                        >
                          <ChevronUp className="w-3 h-3" />
                          <span>{msg.upvote_count || 0}</span>
                        </button>
                        
                        {/* Reply button */}
                        <button
                          onClick={() => {
                            setReplyingTo(msg);
                            inputRef.current?.focus();
                          }}
                          className="p-1 hover:bg-white/10 rounded text-white/60 transition-colors"
                        >
                          <Reply className="w-3 h-3" />
                        </button>
                        
                        {/* Delete button (own messages only) */}
                        {isOwn && (
                          <button
                            onClick={() => handleDelete(msg.id)}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400/60 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply indicator */}
      {replyingTo && (
        <div className="px-3 py-2 bg-emerald-900/30 border-t border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <Reply className="w-3 h-3" />
            <span>Replying to {replyingTo.sender_nickname}</span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-white/10 rounded">
            <X className="w-3 h-3 text-white/60" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-emerald-500/20 bg-black/50">
        {playerAddress ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 bg-white/10 border border-emerald-500/30 rounded-full px-4 py-2 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-emerald-400"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <div className="text-center text-white/50 text-sm py-2">
            Connect wallet to chat
          </div>
        )}
      </div>
    </div>
  );
};

export default ScientistChat;
