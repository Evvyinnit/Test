import { useEffect } from 'react';

export default function BurgerSettingsMenu({
  open,
  onClose,
  onOpenBotMenu,
  onOpenChatTools,
  onOpenModelSettings,
  onOpenGroupChat,
  onOpenReportBot,
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const Item = ({ icon, title, subtitle, onClick }) => (
    <button
      onClick={() => {
        onClick?.();
        onClose?.();
      }}
      className="w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
    >
      <span className="material-icons-outlined text-lg text-violet-300 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white">{title}</div>
        {subtitle ? <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div> : null}
      </div>
      <span className="material-icons-outlined text-gray-600 ml-auto">chevron_right</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[88vw] max-w-[360px] bg-[#0f0f17] border-l border-white/10 shadow-2xl flex flex-col">
        <div className="px-4 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined text-violet-400">menu</span>
            <div className="text-white font-semibold">Settings</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors" aria-label="Close">
            <span className="material-icons-outlined text-gray-400">close</span>
          </button>
        </div>

        <div className="p-4 space-y-2 overflow-y-auto">
          <Item
            icon="smart_toy"
            title="Bot menu"
            subtitle="Conversation actions and generation sliders"
            onClick={onOpenBotMenu}
          />
          <Item
            icon="auto_awesome"
            title="Chat tools"
            subtitle="Memory, prompts, branches, export"
            onClick={onOpenChatTools}
          />
          <Item
            icon="tune"
            title="Model settings"
            subtitle="Global model + defaults"
            onClick={onOpenModelSettings}
          />
          {onOpenReportBot ? (

          <Item
            icon="report"
            title="Report bot"
            subtitle="Report abuse, spam or policy violations"
            onClick={onOpenReportBot}
          />
          ) : null}
        </div>

        <div className="mt-auto p-4 border-t border-white/5">
          <p className="text-[11px] text-gray-600">
            Tip: Changes apply instantly after you save in each section.
          </p>
        </div>
      </div>
    </div>
  );
}
