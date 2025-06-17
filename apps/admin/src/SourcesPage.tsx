import { useQuery, useMutation } from 'urql';
import { useState } from 'react';

const SOURCES_QUERY = `
  query Sources {
    sources {
      id
      name
      homepageUrl
      rssFeedUrl
      active
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
      lastFetchedAt
    }
  }
`;


interface Source {
  id: string;
  name: string;
  homepageUrl?: string | null;
  rssFeedUrl: string;
  active: boolean;
  lastFetchedAt?: string | null;
}

export default function SourcesPage() {
  const [result, reexecute] = useQuery({ query: SOURCES_QUERY });
  const [, createSource] = useMutation(CREATE_SOURCE);
  const [, updateSourceMut] = useMutation(UPDATE_SOURCE);

  const [form, setForm] = useState({
    name: '',
    homepageUrl: '',
    rssFeedUrl: '',
    active: true,
  });

  const refresh = () => reexecute({ requestPolicy: 'network-only' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSource(form);
    setForm({ name: '', homepageUrl: '', rssFeedUrl: '', active: true });
    refresh();
  };

  const handleUpdate = async (id: string, data: Partial<Source>) => {
    await updateSourceMut({ id, ...data });
    refresh();
  };


  if (result.fetching) return <p>Loading...</p>;
  if (result.error) return <p>Error loading sources</p>;

  return (
    <div>
      <form onSubmit={handleCreate} className="space-x-2 mb-4">
        <input
          className="border p-1"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="border p-1"
          placeholder="Homepage URL"
          value={form.homepageUrl}
          onChange={(e) => setForm({ ...form, homepageUrl: e.target.value })}
        />
        <input
          className="border p-1"
          placeholder="RSS Feed URL"
          value={form.rssFeedUrl}
          onChange={(e) => setForm({ ...form, rssFeedUrl: e.target.value })}
        />
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="mr-1"
          />
          Active
        </label>
        <button type="submit" className="bg-blue-500 text-white px-2 py-1 rounded">
          Add
        </button>
      </form>

      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="p-1">Name</th>
            <th className="p-1">Homepage</th>
            <th className="p-1">RSS Feed</th>
            <th className="p-1">Active</th>
            <th className="p-1">Last Fetched</th>
            <th className="p-1">Save</th>
          </tr>
        </thead>
        <tbody>
          {result.data.sources.map((source: Source) => (
            <SourceRow key={source.id} source={source} onUpdate={handleUpdate} />
          ))}
      </tbody>
    </table>
  </div>
);
}

function SourceRow({
  source,
  onUpdate,
}: {
  source: Source;
  onUpdate: (id: string, data: Partial<Source>) => void;
}) {
  const [data, setData] = useState<Source>(source);

  const save = () => onUpdate(source.id, data);

  return (
    <tr className="border-t">
      <td className="p-1">
        <input
          className="border p-1 w-full"
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
        />
      </td>
      <td className="p-1">
        <input
          className="border p-1 w-full"
          value={data.homepageUrl ?? ''}
          onChange={(e) => setData({ ...data, homepageUrl: e.target.value })}
        />
      </td>
      <td className="p-1">
        <input
          className="border p-1 w-full"
          value={data.rssFeedUrl}
          onChange={(e) => setData({ ...data, rssFeedUrl: e.target.value })}
        />
      </td>
      <td className="p-1 text-center">
        <input
          type="checkbox"
          checked={data.active}
          onChange={(e) => setData({ ...data, active: e.target.checked })}
        />
      </td>
      <td className="p-1 text-gray-600">
        {data.lastFetchedAt ? new Date(data.lastFetchedAt).toLocaleString() : '-'}
      </td>
      <td className="p-1">
        <button onClick={save} className="bg-green-500 text-white px-2 py-1 rounded">
          Save
        </button>
      </td>
    </tr>
  );
}
