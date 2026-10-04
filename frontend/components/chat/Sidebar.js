import { memo } from 'react';

// Session history: overlay drawer on phones (backdrop + 85%-wide panel) and
// the normal in-flow column from md up. Extracted from pages/index.js in
// Phase 6 — module-level + memo, see MessageList for the F7 remount trap.
function Sidebar({ t, isLoggedIn, sidebarOpen, setSidebarOpen, sessions, activeSessionId, onSelect, onNewChat, onDelete }) {
  return (
    <>
      {isLoggedIn && sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setSidebarOpen(false)} />
      )}
      {isLoggedIn && (
        <div className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex fixed md:static inset-y-0 left-0 md:inset-auto z-40 w-[85%] max-w-xs md:w-64 md:max-w-none flex-shrink-0 md:mb-0 flex-col min-h-0 pt-4 md:pt-0 px-2 md:px-0`}>
          <div className="bg-white rounded-xl border border-sky-100 shadow-sm p-3 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-700 font-bold text-sm">💬 {t('chat.history')}</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden flex items-center justify-center text-gray-400 hover:text-gray-600 text-lg min-w-[40px] min-h-[40px] -mr-2 -mt-2"
              >✕</button>
            </div>
            <button
              onClick={onNewChat}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white px-4 py-2.5 rounded-lg transition font-medium text-sm mb-3"
            >
              + {t('chat.newChat')}
            </button>

            <div className="flex-1 overflow-y-auto space-y-1">
              {sessions.length === 0 ? (
                <p className="text-gray-400 text-xs text-center py-4">{t('chat.noSessions')}</p>
              ) : (
                sessions.map(session => (
                  <div
                    key={session.id}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition text-sm ${
                      activeSessionId === session.id
                        ? 'bg-sky-100 text-sky-800 font-medium'
                        : 'text-gray-600 hover:bg-sky-50'
                    }`}
                    onClick={() => onSelect(session.id)}
                  >
                    <span className="flex-1 truncate">{session.subject || t('chat.untitled')}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                      className="flex items-center justify-center w-10 h-10 -my-2 flex-shrink-0 text-red-400 hover:text-red-500 text-sm rounded-md active:bg-red-50 md:hidden md:group-hover:flex group-focus-within:flex"
                      title={t('chat.deleteSession')}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(Sidebar);
