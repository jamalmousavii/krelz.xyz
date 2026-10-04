import { memo } from 'react';

// Shared composer for both homepage states: model picker, 📎/🎙 controls,
// attachment chip + error, text input and send button. `variant` picks the
// empty-state ("hero") or in-chat styling. Extracted from pages/index.js in
// Phase 6 as a module-level component (F7: an inline component type would
// remount the hidden file input on every keystroke and drop the selection).
const CATEGORY_ICONS = { chat: '💬', code: '💻', vision: '👁️', embedding: '🔗' };

function Composer({
  variant = 'chat',
  t, message, setMessage, sendMessage, loading,
  models, selectedModel, selectedModelData, setSelectedModel,
  dropdownOpen, setDropdownOpen, dropdownRef, inputRef,
  fileInputRef, onPickFile, attachFileAllowed, audioOk,
  recording, startRecording, stopRecording,
  attachment, removeAttachment, attachError,
}) {
  const renderModelDropdown = ({ upward }) => (
    <div className="relative flex-1 md:flex-none md:w-auto min-w-0" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="w-full md:w-auto bg-white hover:bg-sky-50 text-gray-700 border border-sky-200 px-4 py-3 md:py-3.5 rounded-xl transition flex items-center gap-2 min-w-[180px] justify-between text-sm shadow-sm"
      >
        <span className="truncate font-medium">
          {selectedModelData ? `${CATEGORY_ICONS[selectedModelData.category]} ${selectedModelData.name}` : selectedModel}
        </span>
        <span className="text-gray-400 text-xs">▼</span>
      </button>
      {dropdownOpen && (
        <div className={`absolute ${upward ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 w-full md:w-72 bg-white border border-sky-200 rounded-xl shadow-xl overflow-hidden z-50 max-h-[min(300px,40dvh)] overflow-y-auto`}>
          {models.map((model) => {
            const isSelected = selectedModel === model.id;
            const hasMiners = model.miners_online > 0;
            const canSelect = hasMiners;
            return (
              <button
                key={model.id}
                onClick={() => { if (canSelect) { setSelectedModel(model.id); setDropdownOpen(false); } }}
                disabled={!canSelect}
                className={`w-full text-left px-4 py-3 flex items-center justify-between transition text-sm border-b border-sky-50 last:border-0 ${
                  isSelected ? 'bg-sky-100 text-sky-800' : canSelect ? 'hover:bg-sky-50 text-gray-700' : 'opacity-40 cursor-not-allowed text-gray-400'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span>{CATEGORY_ICONS[model.category]}</span>
                  <span className="truncate font-medium">{model.name}</span>
                  <span className="text-sky-600 text-xs">{model.size}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {hasMiners ? (
                    <span className="text-emerald-600 text-xs">✅ {model.miners_online}</span>
                  ) : (
                    <span className="text-red-400 text-xs">⚠️ 0</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderMediaButtons = () => (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.txt,.md,.csv,.json,application/pdf,text/*"
        className="hidden"
        onChange={onPickFile}
      />
      <button
        type="button"
        onClick={() => { if (attachFileAllowed) fileInputRef.current?.click(); }}
        disabled={!attachFileAllowed}
        title={attachFileAllowed ? t('chat.attach') : t('chat.attachEmbedding')}
        className="flex-shrink-0 w-10 h-10 md:h-12 rounded-xl border border-sky-200 bg-white text-base hover:bg-sky-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={t('chat.attach')}
      >📎</button>
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        disabled={!audioOk && !recording}
        title={audioOk ? (recording ? t('chat.voiceStop') : t('chat.voice')) : t('chat.needAudioModel')}
        className={`flex-shrink-0 w-10 h-10 md:h-12 rounded-xl border text-base transition disabled:opacity-40 disabled:cursor-not-allowed ${
          recording ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'border-sky-200 bg-white hover:bg-sky-50'
        }`}
        aria-label={recording ? t('chat.voiceStop') : t('chat.voice')}
      >{recording ? '⏹' : '🎙️'}</button>
    </div>
  );

  const pendingAttachmentChip = attachment && (
    <div className="flex items-center gap-2 bg-white border border-sky-200 rounded-full pl-2.5 pr-2 py-1.5 text-xs text-gray-700 shadow-sm max-w-full">
      {attachment.type === 'image' ? (
        <img src={`data:${attachment.mime || 'image/jpeg'};base64,${attachment.data}`} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
      ) : (
        <span>{attachment.type === 'audio' ? '🎙️' : '📄'}</span>
      )}
      <span className="truncate max-w-[160px]">{attachment.name}</span>
      <button
        type="button"
        onClick={removeAttachment}
        className="flex items-center justify-center w-9 h-9 -my-1.5 -mr-1.5 text-gray-400 hover:text-red-500 font-bold rounded-md active:bg-red-50"
        title={t('chat.removeAttachment')}
      >✕</button>
    </div>
  );

  const attachErrorLine = attachError ? (
    <div className="text-red-500 text-xs">⚠️ {attachError}</div>
  ) : null;

  return (
    <>
      {(attachment || attachError) && (
        <div className={`flex flex-col gap-1.5 ${variant === 'hero' ? 'mb-3' : 'mb-2'} items-start`}>
          {pendingAttachmentChip}
          {attachErrorLine}
        </div>
      )}
      <div className="flex flex-col md:flex-row gap-2 md:gap-3">
        <div className="flex items-center gap-2 md:contents">
          {renderModelDropdown({ upward: variant === 'chat' })}
          {renderMediaButtons()}
        </div>
        <div className="flex gap-2 md:contents">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) sendMessage(); }}
            placeholder={t('chat.placeholder')}
            className={`flex-1 min-w-0 text-gray-800 placeholder-gray-500 border px-4 md:px-6 py-3 md:py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm md:text-base ${variant === 'hero' ? 'bg-sky-50 border-sky-100' : 'bg-white border-sky-200 shadow-sm'}`}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className={`${variant === 'hero' ? 'w-auto md:w-auto ' : ''}bg-sky-500 hover:bg-sky-600 text-white px-6 md:px-8 py-3 md:py-3.5 rounded-xl transition disabled:opacity-50 font-bold text-sm md:text-base shadow-sm flex-shrink-0`}
          >
            {loading ? '...' : t('chat.send')}
          </button>
        </div>
      </div>
    </>
  );
}

export default memo(Composer);
