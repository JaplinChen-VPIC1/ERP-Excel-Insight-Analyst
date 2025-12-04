
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Loader2, Sparkles, Paperclip, Grip, Search, ArrowLeft } from 'lucide-react';
import { ChatMessage, ExcelDataRow, AnalysisResult, Language, ChatAttachment } from '../types';
import { analyzeDataWithGemini } from '../services/geminiService';
import { translations } from '../i18n';

interface ChatBotProps {
  data: ExcelDataRow[];
  onAnalysisUpdate: (result: AnalysisResult) => void;
  language: Language;
}

const ChatBot: React.FC<ChatBotProps> = ({ data, onAnalysisUpdate, language }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const t = translations[language];
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<ChatAttachment | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Window State for Drag and Resize
  const [windowState, setWindowState] = useState<{
    x: number | null;
    y: number | null;
    width: number;
    height: number;
  }>({
    x: null, 
    y: null,
    width: 384, // default width
    height: 500 // default height
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; winX: number; winY: number; w: number; h: number } | null>(null);

  // Initialize welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'ai',
        content: t.welcomeMessage,
        timestamp: Date.now(),
      }]);
    }
  }, [language]); 

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isSearchOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, pendingImage, isSearchOpen]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Global Mouse Events for Dragging and Resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const start = dragStartRef.current;

      if (isDragging) {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        setWindowState(prev => ({
          ...prev,
          x: start.winX + dx,
          y: start.winY + dy
        }));
      } else if (isResizing) {
        // Resizing from Top-Left corner logic (expanding upwards/leftwards)
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        
        const newWidth = Math.max(300, start.w - dx);
        const newHeight = Math.max(400, start.h - dy);
        
        const newX = start.winX + (start.w - newWidth);
        const newY = start.winY + (start.h - newHeight);

        setWindowState(prev => ({
          ...prev,
          width: newWidth,
          height: newHeight,
          x: newX,
          y: newY
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      dragStartRef.current = null;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing]);


  const startDrag = (e: React.MouseEvent) => {
    if (!windowRef.current) return;
    
    const rect = windowRef.current.getBoundingClientRect();
    const currentX = windowState.x === null ? rect.left : windowState.x;
    const currentY = windowState.y === null ? rect.top : windowState.y;

    if (windowState.x === null) {
      setWindowState(prev => ({ ...prev, x: rect.left, y: rect.top }));
    }

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      winX: currentX!,
      winY: currentY!,
      w: windowState.width,
      h: windowState.height
    };
    setIsDragging(true);
    document.body.style.cursor = 'move';
  };

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!windowRef.current) return;

    const rect = windowRef.current.getBoundingClientRect();
    const currentX = windowState.x === null ? rect.left : windowState.x;
    const currentY = windowState.y === null ? rect.top : windowState.y;

    if (windowState.x === null) {
      setWindowState(prev => ({ ...prev, x: rect.left, y: rect.top }));
    }

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      winX: currentX!,
      winY: currentY!,
      w: windowState.width,
      h: windowState.height
    };
    setIsResizing(true);
    document.body.style.cursor = 'nwse-resize';
  };


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Content = base64String.split(',')[1];
          setPendingImage({
            type: 'image',
            content: base64Content,
            mimeType: file.type
          });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            setPendingImage({
              type: 'image',
              content: base64String.split(',')[1],
              mimeType: file.type
            });
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !pendingImage) || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
      attachment: pendingImage || undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingImage(null);
    setIsTyping(true);

    // Reset textarea height
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }

    try {
      const newAnalysis = await analyzeDataWithGemini(
        data, 
        language, 
        userMsg.content,
        userMsg.attachment, 
        [...messages, userMsg]
      );
      
      onAnalysisUpdate(newAnalysis);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `${t.aiUpdateMessage} ${newAnalysis.summary}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: t.aiErrorMessage,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const searchResults = searchQuery 
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all z-40 animate-bounce-in"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <div 
          ref={windowRef}
          className="bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 z-50 overflow-hidden transition-shadow"
          style={{
            position: windowState.x !== null ? 'fixed' : 'fixed',
            left: windowState.x !== null ? windowState.x : undefined,
            top: windowState.y !== null ? windowState.y : undefined,
            bottom: windowState.y === null ? '24px' : undefined,
            right: windowState.x === null ? '24px' : undefined,
            width: windowState.width,
            height: windowState.height,
          }}
        >
          {/* Header */}
          <div 
            className="bg-blue-600 p-4 flex justify-between items-center cursor-move select-none h-16"
            onMouseDown={startDrag}
          >
            {isSearchOpen ? (
                <div className="flex items-center gap-2 w-full animate-fade-in">
                    <button 
                        onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                        className="text-white hover:bg-blue-500 rounded-full p-1"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <input 
                        type="text" 
                        placeholder={t.searchChat || "Search..."}
                        className="flex-1 bg-white text-gray-800 placeholder-gray-400 text-sm rounded-lg px-3 py-1.5 outline-none border border-blue-500 focus:border-blue-300 shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        autoFocus
                    />
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-2 text-white">
                        <Bot className="w-5 h-5" />
                        <h3 className="font-bold">{t.chatTitle}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsSearchOpen(true); }} 
                            className="text-white/80 hover:text-white hover:bg-blue-500 p-1.5 rounded-lg transition-colors"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} 
                            className="text-white/80 hover:text-white hover:bg-blue-500 p-1.5 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </>
            )}
          </div>
          
          {/* Resize Grip (Top Left) */}
          <div 
            className="absolute top-0 left-0 w-6 h-6 cursor-nwse-resize z-50 opacity-0 hover:opacity-100 flex items-center justify-center bg-transparent group"
            onMouseDown={startResize}
            title="Resize"
          >
            <Grip className="w-4 h-4 text-white transform -rotate-45 drop-shadow-md" />
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
            {isSearchOpen && searchQuery ? (
                <>
                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
                        {t.searchResults || "Search Results"}
                    </div>
                    {searchResults.length > 0 ? (
                        searchResults.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex flex-col gap-1 p-3 rounded-lg border ${
                                    msg.role === 'user' ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'
                                }`}
                            >
                                <div className="flex justify-between items-center text-xs text-gray-400">
                                    <span className="font-semibold">{msg.role === 'user' ? 'You' : 'AI'}</span>
                                    <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <p className="text-sm text-gray-800 line-clamp-3 whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-gray-400 text-sm mt-8">
                            {t.noResults || "No messages found"}
                        </div>
                    )}
                </>
            ) : (
                <>
                    {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                        className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                            msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                        }`}
                        >
                        {msg.attachment && (
                            <img 
                            src={`data:${msg.attachment.mimeType};base64,${msg.attachment.content}`} 
                            alt="attachment" 
                            className="max-w-full rounded-lg mb-2 border border-white/20"
                            />
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <span className={`text-[10px] block mt-1 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        </div>
                    </div>
                    ))}
                    {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
                        <span className="text-xs text-gray-500 italic">{t.chatTyping}</span>
                        </div>
                    </div>
                    )}
                    <div ref={messagesEndRef} />
                </>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-100">
            {pendingImage && (
              <div className="flex items-center gap-2 mb-2 bg-blue-50 p-2 rounded-lg border border-blue-100">
                <Paperclip className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-blue-700 truncate max-w-[200px]">{t.chatImageAttached}</span>
                <button onClick={() => setPendingImage(null)} className="ml-auto text-blue-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
                title={t.chatAttachImage}
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileSelect} 
              />
              
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={t.chatPlaceholder}
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 max-h-32 resize-none"
                rows={1}
                style={{ minHeight: '36px' }}
              />
              
              <button
                onClick={() => handleSubmit()}
                disabled={(!input.trim() && !pendingImage) || isTyping}
                className={`p-2 rounded-lg transition-all ${
                  (!input.trim() && !pendingImage) || isTyping
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                }`}
              >
                {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;
