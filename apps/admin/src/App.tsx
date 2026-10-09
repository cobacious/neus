import { useState, useMemo } from 'react';
import { cacheExchange, createClient, fetchExchange, Provider } from 'urql';
import SourcesPage from './SourcesPage';
import { ENVIRONMENTS, DEFAULT_ENV_ID, EnvironmentConfig } from './environments';

export default function App() {
  const [selectedEnvId, setSelectedEnvId] = useState<string>(() => {
    try {
      return localStorage.getItem('neus_admin_target_env') || DEFAULT_ENV_ID;
    } catch {
      return DEFAULT_ENV_ID;
    }
  });

  const activeEnv: EnvironmentConfig = useMemo(() => {
    return ENVIRONMENTS.find((e) => e.id === selectedEnvId) || ENVIRONMENTS[0];
  }, [selectedEnvId]);

  const handleSelectEnv = (id: string) => {
    setSelectedEnvId(id);
    try {
      localStorage.setItem('neus_admin_target_env', id);
    } catch {
      // ignore storage errors
    }
  };

  const client = useMemo(() => {
    return createClient({
      url: activeEnv.url,
      exchanges: [cacheExchange, fetchExchange],
    });
  }, [activeEnv.url]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-16">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight text-gray-900">Neus</span>
              <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                Admin
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              RSS Feed Management & Ingestion Controls
            </p>
          </div>

          {/* Environment Switcher */}
          <div className="flex items-center space-x-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Target API:
            </span>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 shadow-inner">
              {ENVIRONMENTS.map((env) => {
                const isSelected = env.id === activeEnv.id;
                return (
                  <button
                    key={env.id}
                    onClick={() => handleSelectEnv(env.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      isSelected
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? env.dotClass : 'bg-gray-400'
                      }`}
                    />
                    <span>{env.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Environment Status Sub-bar */}
        <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-2">
          <div className="max-w-6xl mx-auto flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${activeEnv.badgeClass}`}
              >
                {activeEnv.name}
              </span>
              <span className="text-gray-500 font-mono text-[11px]">
                {activeEnv.url}
              </span>
            </div>
            {activeEnv.id === 'production' && (
              <span className="text-amber-700 font-medium">
                ⚠️ Live Production Database — changes take effect immediately
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6">
        <Provider value={client} key={activeEnv.url}>
          <SourcesPage activeEnv={activeEnv} />
        </Provider>
      </main>
    </div>
  );
}
