import { memo } from 'react';
import { isRtl } from '../../i18n/translations';
import UpgradeWall from './UpgradeWall';

// Chat transcript: bubbles, media chips, source/payment captions, typing
// indicator, scroll spacer. Extracted from pages/index.js in Phase 6 —
// module-level + memo (defining this inside Home would create a new component
// type each render and remount the whole subtree, F7).
function MessageList({ messagesRef, chat, loading, lang, t, hasSubjectBar, purchasePlan, purchaseTokens, bundleAmount, setBundleAmount, purchaseError }) {
  const rtl = isRtl(lang);
  return (
    <div ref={messagesRef} className={`bg-white border border-gray-200/80 ${hasSubjectBar ? 'rounded-b-2xl' : 'rounded-2xl'} p-3 md:p-5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain mb-3 shadow-sm`}>
      {chat.map((msg, i) => (
        <div key={i} className={`mb-4 ${msg.role === 'user' ? (rtl ? 'text-left' : 'text-right') : (rtl ? 'text-right' : 'text-left')}`}>
          <div className={`inline-block max-w-[85%] rounded-2xl text-sm md:text-base ${
            msg.role === 'user'
              ? 'bg-gray-100 text-gray-900 p-3 md:p-4 md:max-w-[80%]'
              : 'bg-transparent text-gray-800 p-0 md:max-w-[90%]'
          }`}>
            {msg.media && msg.media.type === 'image' && msg.media.data && (
              <img
                src={`data:${msg.media.mime || 'image/jpeg'};base64,${msg.media.data}`}
                alt={msg.media.name || 'image'}
                loading="lazy"
                decoding="async"
                className="rounded-xl max-h-48 md:max-h-64 max-w-full mb-2"
              />
            )}
            {msg.media && msg.media.type !== 'image' && (
              <div className="inline-flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 mb-1 bg-white text-gray-600 border border-gray-200">
                <span>{msg.media.type === 'audio' ? '🎙️' : '📄'}</span>
                <span className="truncate max-w-[180px]">{msg.media.name}</span>
              </div>
            )}
            {msg.upgrade_wall ? (
              <UpgradeWall
                wall={msg.upgrade_wall}
                content={msg.content}
                t={t}
                purchasePlan={purchasePlan}
                purchaseTokens={purchaseTokens}
                bundleAmount={bundleAmount}
                setBundleAmount={setBundleAmount}
                purchaseError={purchaseError}
              />
            ) : msg.content ? <div className="break-words whitespace-pre-wrap">{msg.content}</div> : null}
          </div>
          {msg.role === 'assistant' && (
            <div className={`text-xs text-gray-400 mt-1 ${rtl ? 'text-right' : 'text-left'}`}>
              {msg.source === 'miner' && (
                <span className="text-emerald-600">⛏️ {t('chat.viaMiner')}{msg.miner_id ? ` #${msg.miner_id}` : ''}</span>
              )}
              {msg.source === 'local' && (
                <span>💻 {t('chat.viaLocal')}</span>
              )}
              {msg.payment_status === 'free_miner' && (
                <span className="text-amber-600"> 🎁 {t('chat.freeMinerCredit')}</span>
              )}
              {msg.payment_status === 'tokens' && (
                <span className="text-sky-600"> 🎟️ {t('chat.paidTokens')}</span>
              )}
            </div>
          )}
        </div>
      ))}
      {loading && (
        <div className={rtl ? 'text-right' : 'text-left'}>
          <div className="inline-block bg-gray-100 text-gray-600 rounded-2xl px-4 py-3 text-sm md:text-base animate-pulse">{t('chat.typing')}</div>
        </div>
      )}
      <div />
    </div>
  );
}

export default memo(MessageList);
