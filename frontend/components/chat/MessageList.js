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
    <div ref={messagesRef} className={`bg-white border border-sky-100 ${hasSubjectBar ? 'rounded-b-xl' : 'rounded-xl'} p-3 md:p-5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain mb-3 shadow-sm`}>
      {chat.map((msg, i) => (
        <div key={i} className={`mb-4 ${msg.role === 'user' ? (rtl ? 'text-right' : 'text-left') : (rtl ? 'text-left' : 'text-right')}`}>
          <div className={`inline-block max-w-[85%] md:max-w-[80%] p-3 md:p-4 rounded-2xl text-sm md:text-base ${
            msg.role === 'user'
              ? 'bg-sky-500 text-white'
              : 'bg-sky-50 text-gray-800 border border-sky-100'
          }`}>
            {msg.media && msg.media.type === 'image' && msg.media.data && (
              <img
                src={`data:${msg.media.mime || 'image/jpeg'};base64,${msg.media.data}`}
                alt={msg.media.name || 'image'}
                className="rounded-xl max-h-48 md:max-h-64 max-w-full mb-2"
              />
            )}
            {msg.media && msg.media.type !== 'image' && (
              <div className={`inline-flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 mb-1 ${
                msg.role === 'user' ? 'bg-white/20 text-white' : 'bg-white border border-sky-100 text-gray-600'
              }`}>
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
            <div className={`text-xs text-gray-400 mt-1 ${rtl ? 'text-left' : 'text-right'}`}>
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
        <div className={rtl ? 'text-left' : 'text-right'}>
          <div className="inline-block bg-sky-50 text-gray-600 border border-sky-100 p-3 md:p-4 rounded-2xl text-sm md:text-base">{t('chat.typing')}</div>
        </div>
      )}
      <div />
    </div>
  );
}

export default memo(MessageList);
