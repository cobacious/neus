import { useQuery, useMutation } from 'urql';
import { useState, useEffect } from 'react';
import { EnvironmentConfig } from './environments';

const SOURCES_QUERY = `
  query Sources {
    sources {
      id
      name
      homepageUrl
      rssFeedUrl
      active
      faviconUrl
      lastFetchedAt
    }
  }
`;

const CREATE_SOURCE = `
  mutation CreateSource($name: String!, $homepageUrl: String, $rssFeedUrl: String!, $active: Boolean) {
    createSource(name: $name, homepageUrl: $homepageUrl, rssFeedUrl: $rssFeedUrl, active: $active) {
      id
      name
      homepageUrl
      rssFeedUrl
      active
      faviconUrl
      lastFetchedAt
    }
  }
`;

const UPDATE_SOURCE = `
  mutation UpdateSource($id: String!, $name: String, $homepageUrl: String, $rssFeedUrl: String, $active: Boolean) {
    updateSource(id: $id, name: $name, homepageUrl: $homepageUrl, rssFeedUrl: $rssFeedUrl, active: $active) {
      id
      name
      homepageUrl
      rssFeedUrl
      active
      faviconUrl
      lastFetchedAt
    }
  }
`;

export interface Source {
  id: string;
  name: string;
  homepageUrl?: string | null;
  rssFeedUrl: string;
  active: boolean;
  faviconUrl?: string | null;
  lastFetchedAt?: string | null;
}

interface SourcesPageProps {
  activeEnv: EnvironmentConfig;
}

export default function SourcesPage({ activeEnv }: SourcesPageProps) {
  const [result, reexecute] = useQuery({
    query: SOURCES_QUERY,
    requestPolicy: 'network-only',
  });
  const [, createSource] = useMutation(CREATE_SOURCE);
  const [, updateSourceMut] = useMutation(UPDATE_SOURCE);

  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newForm, setNewForm] = useState({
    name: '',
    homepageUrl: '',
    rssFeedUrl: '',
    active: true,
  });

  const refresh = () => reexecute({ requestPolicy: 'network-only' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.name || !newForm.rssFeedUrl) return;
    setIsSubmitting(true);
    try {
      await createSource(newForm);
      setNewForm({ name: '', homepageUrl: '', rssFeedUrl: '', active: true });
      setShowAddForm(false);
      refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, data: Partial<Source>) => {
    const res = await updateSourceMut({ id, ...data });
    if (!res.error) {
      refresh();
    }
    return res;
  };

  if (result.fetching) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
        <div className="inline-block animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-3" />
        <p className="text-sm font-medium text-gray-700">Connecting to {activeEnv.name}...</p>
        <p className="text-xs text-gray-400 font-mono mt-1">{activeEnv.url}</p>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-8 shadow-sm">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600 font-bold">
            !
          </div>
          <div>
            <h3 className="text-sm font-semibold text-red-900">
              Unable to connect to {activeEnv.name}
            </h3>
            <p className="text-xs text-red-700 mt-1">
              GraphQL request failed at <code className="font-mono bg-red-50 px-1 py-0.5 rounded">{activeEnv.url}</code>: {result.error.message}
            </p>
            {activeEnv.id === 'local' && (
              <p className="text-xs text-gray-600 mt-2">
                Make sure your local GraphQL API server is running on port 4040 (<code className="bg-gray-100 px-1 py-0.5 rounded">pnpm dev</code> or <code className="bg-gray-100 px-1 py-0.5 rounded">pnpm start:api</code>).
              </p>
            )}
            <div className="mt-4">
              <button
                onClick={refresh}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md shadow-sm transition"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const allSources: Source[] = result.data?.sources ?? [];
  const activeCount = allSources.filter((s) => s.active).length;
  const inactiveCount = allSources.length - activeCount;

  const filteredSources = allSources.filter((s) => {
    if (filterMode === 'active' && !s.active) return false;
    if (filterMode === 'inactive' && s.active) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.rssFeedUrl.toLowerCase().includes(q) ||
        (s.homepageUrl && s.homepageUrl.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-2">
          {/* Search box */}
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-1.5 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Search feed name or URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Filter Pills */}
          <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 text-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterMode === 'all'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              All ({allSources.length})
            </button>
            <button
              onClick={() => setFilterMode('active')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterMode === 'active'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-gray-500 hover:text-emerald-700'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilterMode('inactive')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterMode === 'inactive'
                  ? 'bg-white text-gray-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Inactive ({inactiveCount})
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={refresh}
            title="Refresh list"
            className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-md transition"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md shadow-xs transition"
          >
            {showAddForm ? 'Cancel' : '+ Add New Source'}
          </button>
        </div>
      </div>

      {/* Add New Source Form (collapsible) */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white p-4 rounded-lg border border-blue-200 shadow-xs space-y-3"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
            Add New RSS Source to {activeEnv.shortLabel}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Publication Name *
              </label>
              <input
                required
                className="border border-gray-300 rounded p-1.5 w-full text-xs"
                placeholder="e.g. Financial Times"
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Homepage URL
              </label>
              <input
                className="border border-gray-300 rounded p-1.5 w-full text-xs"
                placeholder="https://www.ft.com"
                value={newForm.homepageUrl}
                onChange={(e) => setNewForm({ ...newForm, homepageUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                RSS Feed URL *
              </label>
              <input
                required
                className="border border-gray-300 rounded p-1.5 w-full text-xs"
                placeholder="https://www.ft.com/?format=rss"
                value={newForm.rssFeedUrl}
                onChange={(e) => setNewForm({ ...newForm, rssFeedUrl: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center text-xs font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newForm.active}
                onChange={(e) => setNewForm({ ...newForm, active: e.target.checked })}
                className="mr-1.5 rounded text-blue-600 focus:ring-blue-500"
              />
              Enable immediately for pipeline crawling
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium px-4 py-1.5 rounded transition"
            >
              {isSubmitting ? 'Creating...' : 'Create Source'}
            </button>
          </div>
        </form>
      )}

      {/* Sources Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-2.5 px-3 text-left font-semibold">Status</th>
              <th className="py-2.5 px-3 text-left font-semibold">Publication</th>
              <th className="py-2.5 px-3 text-left font-semibold">Homepage URL</th>
              <th className="py-2.5 px-3 text-left font-semibold">RSS Feed URL</th>
              <th className="py-2.5 px-3 text-left font-semibold">Last Ingested</th>
              <th className="py-2.5 px-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredSources.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No sources match your search or filter.
                </td>
              </tr>
            ) : (
              filteredSources.map((source) => (
                <SourceRow
                  key={`${source.id}-${source.active}-${source.name}`}
                  source={source}
                  onUpdate={handleUpdate}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SourceRow({
  source,
  onUpdate,
}: {
  source: Source;
  onUpdate: (id: string, data: Partial<Source>) => Promise<any>;
}) {
  const [data, setData] = useState<Source>(source);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setData(source);
  }, [source]);

  const handleToggleActive = async () => {
    const nextActive = !data.active;
    setData({ ...data, active: nextActive });
    setIsSaving(true);
    try {
      await onUpdate(source.id, { active: nextActive });
      setSaveMessage(nextActive ? 'Activated' : 'Deactivated');
      setTimeout(() => setSaveMessage(null), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFields = async () => {
    setIsSaving(true);
    try {
      await onUpdate(source.id, {
        name: data.name,
        homepageUrl: data.homepageUrl,
        rssFeedUrl: data.rssFeedUrl,
        active: data.active,
      });
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(null), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const hasDirtyFields =
    data.name !== source.name ||
    data.homepageUrl !== (source.homepageUrl ?? '') ||
    data.rssFeedUrl !== source.rssFeedUrl;

  return (
    <tr
      className={`hover:bg-gray-50/80 transition-colors ${
        !data.active ? 'bg-gray-50/40 text-gray-500' : ''
      }`}
    >
      {/* Active Toggle Switch */}
      <td className="py-2.5 px-3 whitespace-nowrap">
        <button
          onClick={handleToggleActive}
          disabled={isSaving}
          title={data.active ? 'Click to deactivate feed' : 'Click to activate feed'}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border transition ${
            data.active
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
              : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
              data.active ? 'bg-emerald-500' : 'bg-gray-400'
            }`}
          />
          {data.active ? 'Active' : 'Inactive'}
        </button>
      </td>

      {/* Name */}
      <td className="py-2 px-3">
        <input
          className="border border-gray-200 hover:border-gray-300 focus:border-blue-500 rounded p-1 w-full text-xs font-medium"
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
        />
      </td>

      {/* Homepage */}
      <td className="py-2 px-3">
        <input
          className="border border-gray-200 hover:border-gray-300 focus:border-blue-500 rounded p-1 w-full text-xs text-gray-600"
          value={data.homepageUrl ?? ''}
          placeholder="https://..."
          onChange={(e) => setData({ ...data, homepageUrl: e.target.value })}
        />
      </td>

      {/* RSS Feed URL */}
      <td className="py-2 px-3">
        <div className="flex items-center space-x-1">
          <input
            className="border border-gray-200 hover:border-gray-300 focus:border-blue-500 rounded p-1 w-full text-xs font-mono text-gray-700"
            value={data.rssFeedUrl}
            onChange={(e) => setData({ ...data, rssFeedUrl: e.target.value })}
          />
          <a
            href={data.rssFeedUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open feed XML in new tab"
            className="text-gray-400 hover:text-blue-600 p-1"
          >
            ↗
          </a>
        </div>
      </td>

      {/* Last Ingested */}
      <td className="py-2.5 px-3 whitespace-nowrap text-gray-500 font-mono text-[11px]">
        {data.lastFetchedAt ? new Date(data.lastFetchedAt).toLocaleString() : 'Never'}
      </td>

      {/* Save Action */}
      <td className="py-2.5 px-3 whitespace-nowrap text-right">
        <div className="inline-flex items-center space-x-2">
          {saveMessage && (
            <span className="text-[11px] font-medium text-emerald-600 animate-fade">
              {saveMessage}
            </span>
          )}
          <button
            onClick={handleSaveFields}
            disabled={isSaving || !hasDirtyFields}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              hasDirtyFields
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? '...' : 'Save'}
          </button>
        </div>
      </td>
    </tr>
  );
}
