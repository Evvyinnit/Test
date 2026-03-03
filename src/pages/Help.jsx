import React from 'react';

export default function Help() {
  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0f] text-gray-300">
      <div className="max-w-4xl mx-auto p-6 space-y-12">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            How to use <span className="text-violet-400">Nevy AI</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            A quick guide to navigating the platform, chatting with characters, and tuning your model settings.
          </p>
        </div>

        {/* Navigation Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <span className="material-icons-outlined text-violet-400 text-3xl">map</span>
            <h2 className="text-2xl font-semibold text-white">Navigating the Site</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#12121a] p-5 rounded-xl border border-white/5 hover:border-violet-500/20 transition-colors">
              <h3 className="font-medium text-white mb-2 flex items-center gap-2">
                <span className="material-icons-outlined text-violet-400">search</span>
                Search (Gallery)
              </h3>
              <p className="text-sm text-gray-400">
                Browse public characters, search by name/personality/creator, and sort by New, Top, or All Time.
              </p>
            </div>
            <div className="bg-[#12121a] p-5 rounded-xl border border-white/5 hover:border-violet-500/20 transition-colors">
              <h3 className="font-medium text-white mb-2 flex items-center gap-2">
                <span className="material-icons-outlined text-violet-400">add_circle_outline</span>
                Create Character
              </h3>
              <p className="text-sm text-gray-400">
                Build a character from scratch or import a character card, then set visibility and content rating.
              </p>
            </div>
            <div className="bg-[#12121a] p-5 rounded-xl border border-white/5 hover:border-violet-500/20 transition-colors">
              <h3 className="font-medium text-white mb-2 flex items-center gap-2">
                <span className="material-icons-outlined text-violet-400">groups</span>
                Members
              </h3>
              <p className="text-sm text-gray-400">
                Explore the community list, search members, and open profiles to see their bots.
              </p>
            </div>
            <div className="bg-[#12121a] p-5 rounded-xl border border-white/5 hover:border-violet-500/20 transition-colors">
              <h3 className="font-medium text-white mb-2 flex items-center gap-2">
                <span className="material-icons-outlined text-violet-400">smart_toy</span>
                My Bots
              </h3>
              <p className="text-sm text-gray-400">
                Manage your creations. View stats, edit details, or delete characters you own.
              </p>
            </div>
            <div className="bg-[#12121a] p-5 rounded-xl border border-white/5 hover:border-violet-500/20 transition-colors">
              <h3 className="font-medium text-white mb-2 flex items-center gap-2">
                <span className="material-icons-outlined text-violet-400">leaderboard</span>
                Leaderboard
              </h3>
              <p className="text-sm text-gray-400">
                Compare top bots and users by chats, messages, loves, ratings, and levels.
              </p>
            </div>
            <div className="bg-[#12121a] p-5 rounded-xl border border-white/5 hover:border-violet-500/20 transition-colors">
              <h3 className="font-medium text-white mb-2 flex items-center gap-2">
                <span className="material-icons-outlined text-violet-400">account_circle</span>
                Profiles
              </h3>
              <p className="text-sm text-gray-400">
                Visit profiles to view bios, socials, and bots. Edit your own profile and personas from your page.
              </p>
            </div>
          </div>
        </section>

        {/* Chats & Library Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <span className="material-icons-outlined text-violet-400 text-3xl">chat</span>
            <h2 className="text-2xl font-semibold text-white">Chats & Library</h2>
          </div>
          <div className="prose prose-invert max-w-none text-gray-400">
            <p>
              Recent chats live in the sidebar. Pin important conversations, rename chats, or archive older ones.
            </p>
            <div className="mt-4 bg-[#12121a] p-6 rounded-xl border border-white/5">
              <h3 className="text-lg font-medium text-white mb-3">Quick Tips</h3>
              <ul className="list-disc list-inside space-y-2 marker:text-violet-400">
                <li>Use the pin and archive icons on chat items to organize your list.</li>
                <li>Toggle "Show NSFW Bots" in the sidebar to control what appears in lists.</li>
                <li>Click any character card in the gallery to start a chat.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Using Models Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <span className="material-icons-outlined text-violet-400 text-3xl">psychology</span>
            <h2 className="text-2xl font-semibold text-white">Using AI Models</h2>
          </div>
          <div className="prose prose-invert max-w-none text-gray-400">
            <p>
              Nevy AI supports multiple AI models to power your characters. Choose a model based on speed, creativity, and reasoning needs.
            </p>
            <div className="mt-4 bg-[#12121a] p-6 rounded-xl border border-white/5">
              <h3 className="text-lg font-medium text-white mb-3">Changing Settings</h3>
              <ol className="list-decimal list-inside space-y-2 marker:text-violet-400">
                <li>Open <strong>Model Settings</strong> from the bottom of the sidebar or the tune icon in chat.</li>
                <li>Select a provider (CosmosRP/Pawan, Gemini, Groq, or Mistral).</li>
                <li>Pick a model from the list and add the required API key if needed.</li>
                <li>Adjust optional usage pricing to see estimated costs in chats.</li>
              </ol>
            </div>
            <div className="mt-4 bg-[#12121a] p-6 rounded-xl border border-white/5">
              <h3 className="text-lg font-medium text-white mb-3">Chat Tools</h3>
              <p className="text-sm text-gray-400">
                In a chat, use the sparkle button to open tools for memory, prompts, system instructions, branches, and export.
              </p>
            </div>
          </div>
        </section>

        {/* API Keys Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <span className="material-icons-outlined text-violet-400 text-3xl">key</span>
            <h2 className="text-2xl font-semibold text-white">Getting API Keys</h2>
          </div>
          <p className="text-gray-400">
            Some providers require your own API key. Keys are saved in your account settings so the selected models can be used across devices.
          </p>
          
          <div className="grid gap-4">
            {/* Pawan AI */}
            <div className="flex flex-col md:flex-row gap-4 bg-[#12121a] p-5 rounded-xl border border-white/5 items-start">
              <div className="p-3 bg-violet-500/10 rounded-lg">
                <span className="material-icons-outlined text-violet-400">rocket_launch</span>
              </div>
              <div>
                <h3 className="font-bold text-white">Pawan AI (CosmosRP)</h3>
                <p className="text-sm text-gray-400 mt-1 mb-3">
                  Specialized roleplay models like CosmosRP. Offers a free tier through their Discord community. High quality and vision capable.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a 
                    href="https://discord.gg/pawan" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-medium bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg text-violet-300 transition-colors"
                  >
                    Join Discord <span className="material-icons-outlined text-xs">open_in_new</span>
                  </a>
                  <div className="text-[10px] text-gray-500 flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg">
                    <span className="material-icons-outlined text-xs">info</span>
                    Use /key command in #bot-commands
                  </div>
                </div>
              </div>
            </div>

            {/* Groq AI */}
            <div className="flex flex-col md:flex-row gap-4 bg-[#12121a] p-5 rounded-xl border border-white/5 items-start">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <span className="material-icons-outlined text-orange-400">bolt</span>
              </div>
              <div>
                <h3 className="font-bold text-white">Groq AI</h3>
                <p className="text-sm text-gray-400 mt-1 mb-3">
                  Incredibly fast inference for models like Llama 3 and Mixtral. Perfect for those who want instant responses.
                </p>
                <a 
                  href="https://console.groq.com/keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-medium bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg text-orange-300 transition-colors"
                >
                  Get API Key <span className="material-icons-outlined text-xs">open_in_new</span>
                </a>
              </div>
            </div>

            {/* Mistral AI */}
            <div className="flex flex-col md:flex-row gap-4 bg-[#12121a] p-5 rounded-xl border border-white/5 items-start">
              <div className="p-3 bg-indigo-500/10 rounded-lg">
                <span className="material-icons-outlined text-indigo-400">Waves</span>
              </div>
              <div>
                <h3 className="font-bold text-white">Mistral AI</h3>
                <p className="text-sm text-gray-400 mt-1 mb-3">
                  Powerful open-weights models from France. Known for intelligence and efficient context handling.
                </p>
                <a 
                  href="https://console.mistral.ai/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-medium bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg text-indigo-300 transition-colors"
                >
                  Get API Key <span className="material-icons-outlined text-xs">open_in_new</span>
                </a>
              </div>
            </div>

            {/* Google Gemini */}
            <div className="flex flex-col md:flex-row gap-4 bg-[#12121a] p-5 rounded-xl border border-white/5 items-start">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <span className="material-icons-outlined text-blue-400">auto_awesome</span>
              </div>
              <div>
                <h3 className="font-bold text-white">Google (Gemini Models)</h3>
                <p className="text-sm text-gray-400 mt-1 mb-3">
                  Fast models with large context windows for longer conversations.
                </p>
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-medium bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg text-blue-300 transition-colors"
                >
                  Get API Key <span className="material-icons-outlined text-xs">open_in_new</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-white/5">
          <p className="text-gray-500 text-sm">
            Still have questions? Check the creator link in the sidebar footer.
          </p>
        </div>

      </div>
    </div>
  );
}
