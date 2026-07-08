import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  ADMIN_MODULES_QUERY,
  ADMIN_SAVE_MODULE_MUTATION,
  ADMIN_SET_MODULE_OFFER_MUTATION,
  ADMIN_MODULE_DETAIL_QUERY,
} from '../../../lib/graphql';
import { formatPrice, centsFromDollars } from '../../../lib/admin-utils';
import { Plus, Edit2, X, Save, Tag, Eye } from 'lucide-react';

interface EditingModule {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  active: boolean;
  sortOrder: number;
}

interface OfferingModule {
  id: string;
  offerPrice: number;
  offerLabel: string;
  offerEndsAt: string;
}

interface ModuleType {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  active: boolean;
  sortOrder: number;
  offerPrice?: number;
  offerLabel?: string;
  offerActive?: boolean;
  offerEndsAt?: string;
  offerStartsAt?: string;
  effectivePrice: number;
  usersCount?: number;
}

interface ModuleDetailType {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  active: boolean;
  users: Array<{ id: string; firstName: string; lastName: string; email: string; username: string }>;
  logs: Array<{ id: string; action: string; actor: string; message: string; createdAt: string }>;
}

export const Packages: React.FC<{onToast: (type: 'success'|'error', msg: string) => void}> = ({onToast}) => {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [offerFilter, setOfferFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currencyFilter, setCurrencyFilter] = useState('USD');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const [editing, setEditing] = useState<EditingModule | null>(null);
  const [newModule, setNewModule] = useState(false);
  const [offering, setOffering] = useState<OfferingModule | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const { data, loading, error, refetch } = useQuery<{adminModules: ModuleType[]}, any, any>(ADMIN_MODULES_QUERY, {
    variables: {
      includeInactive: true,
      search: search || null,
      active: activeFilter === 'all' ? null : activeFilter === 'active',
      currency: currencyFilter || null,
      priceMin: minPrice ? centsFromDollars(parseFloat(minPrice)) : null,
      priceMax: maxPrice ? centsFromDollars(parseFloat(maxPrice)) : null,
    }
  });

  const { data: moduleDetailData, loading: moduleDetailLoading } = useQuery<{adminModuleDetail: ModuleDetailType}, {moduleId: string}, any>(
    ADMIN_MODULE_DETAIL_QUERY,
    {
      variables: { moduleId: viewingId || '' },
      skip: !viewingId,
    }
  );

  const [saveModule] = useMutation(ADMIN_SAVE_MODULE_MUTATION);
  const [setOffer] = useMutation(ADMIN_SET_MODULE_OFFER_MUTATION);

  const handleSave = async () => {
    if (!editing) return;
    try {
      await saveModule({
        variables: {
          id: editing.id,
          name: editing.name,
          description: editing.description,
          price: editing.price,
          currency: editing.currency,
          active: editing.active,
          sortOrder: editing.sortOrder,
        },
      });
      onToast('success', `Package "${editing.name}" saved`);
      setEditing(null);
      setNewModule(false);
      refetch();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to save package');
    }
  };

  const handleSetOffer = async () => {
    if (!offering) return;
    try {
      await setOffer({
        variables: {
          id: offering.id,
          offerPrice: offering.offerPrice,
          offerLabel: offering.offerLabel,
          offerEndsAt: offering.offerEndsAt || null,
        },
      });
      onToast('success', 'Offer updated');
      setOffering(null);
      refetch();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to set offer');
    }
  };

  const handleClearOffer = async (id: string) => {
    try {
      await setOffer({
        variables: { id, clear: true },
      });
      onToast('success', 'Offer cleared');
      refetch();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to clear offer');
    }
  };

  useEffect(() => {
    if (viewingId && !moduleDetailLoading && moduleDetailData?.adminModuleDetail) {
      refetch();
    }
  }, [moduleDetailData?.adminModuleDetail, moduleDetailLoading, refetch, viewingId]);

  if (loading) return <div className="text-center py-12 text-slate-500">Loading packages...</div>;
  if (error) return <div className="text-center py-12 text-red-600">Error: {error.message}</div>;

  const now = Date.now();
  const isOfferActive = (module: ModuleType) => {
    if (!module.offerPrice || module.offerPrice <= 0) return false;
    if (module.offerStartsAt && now < new Date(module.offerStartsAt).getTime()) return false;
    if (module.offerEndsAt && now > new Date(module.offerEndsAt).getTime()) return false;
    return true;
  };
  const modules = (data?.adminModules || []).filter((module) => {
    if (offerFilter === 'all') return true;
    const activeOffer = isOfferActive(module);
    return offerFilter === 'active' ? activeOffer : !activeOffer;
  });
  const moduleDetail = moduleDetailData?.adminModuleDetail;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Packages</h2>
          <p className="text-slate-600">Manage pricing, offers, users, and logs</p>
        </div>
        <button
          onClick={() => {
            setNewModule(true);
            setEditing({
              id: `module_${Date.now()}`,
              name: '',
              description: '',
              price: 1000,
              currency: currencyFilter || 'USD',
              active: true,
              sortOrder: modules.length + 1,
            });
          }}
          className="flex items-center gap-2 px-6 py-2 text-white rounded-xl font-bold transition-all hover:scale-105 hover:shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 4px 12px rgba(0, 203, 214, 0.3)'
          }}
        >
          <Plus className="w-4 h-4" />
          New Package
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <input
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search packages"
          />
          <select className="px-3 py-2 border border-slate-300 rounded-lg" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as any)}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select className="px-3 py-2 border border-slate-300 rounded-lg" value={offerFilter} onChange={(e) => setOfferFilter(e.target.value as any)}>
            <option value="all">All offers</option>
            <option value="active">Offer active</option>
            <option value="inactive">Offer inactive</option>
          </select>
          <input
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            placeholder="Currency"
          />
          <input
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Min price"
            type="number"
            step="0.01"
          />
          <input
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max price"
            type="number"
            step="0.01"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {modules.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No packages found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Name</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Price</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Users</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Offer</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Status</th>
                  <th className="text-right py-4 px-6 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => {
                  const offerIsActive = isOfferActive(module);
                  return (
                  <tr key={module.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-800">{module.name}</div>
                      <div className="text-sm text-slate-500">{module.description}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        {offerIsActive ? (
                          <span className="line-through text-slate-400 text-sm">{formatPrice(module.price, module.currency)}</span>
                        ) : null}
                        <div className={offerIsActive ? 'text-emerald-600 font-semibold' : ''}>{formatPrice(module.effectivePrice, module.currency)}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">{module.usersCount || 0}</td>
                    <td className="py-4 px-6">
                      {offerIsActive ? (
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-700">{module.offerLabel}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        module.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {module.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => setViewingId(module.id)}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
                        title="View package detail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setNewModule(false);
                          setEditing({
                            id: module.id,
                            name: module.name,
                            description: module.description || '',
                            price: module.price,
                            currency: module.currency,
                            active: module.active,
                            sortOrder: module.sortOrder || 0,
                          });
                        }}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setOffering({
                            id: module.id,
                            offerPrice: module.offerPrice || module.price,
                            offerLabel: module.offerLabel || '',
                            offerEndsAt: module.offerEndsAt || '',
                          });
                        }}
                        className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg"
                        title="Set/Update offer"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                      {offerIsActive && (
                        <button
                          onClick={() => handleClearOffer(module.id)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                          title="Clear offer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">{newModule ? 'Create New Package' : 'Edit Package'}</h3>
              <button onClick={() => { setEditing(null); setNewModule(false); }} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ID (key)</label>
                  <input
                    type="text"
                    value={editing.id}
                    disabled={!newModule}
                    onChange={(event) => setEditing({ ...editing, id: event.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price ($)</label>
                  <input
                    type="number"
                    value={editing.price / 100}
                    onChange={(event) => setEditing({ ...editing, price: centsFromDollars(parseFloat(event.target.value) || 0) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <input
                    type="text"
                    value={editing.currency}
                    onChange={(event) => setEditing({ ...editing, currency: event.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={editing.description}
                    onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 py-2">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(event) => setEditing({ ...editing, active: event.target.checked })}
                  />
                  Active
                </label>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={editing.sortOrder}
                    onChange={(event) => setEditing({ ...editing, sortOrder: parseInt(event.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700"
                  onClick={() => { setEditing(null); setNewModule(false); }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-white rounded-lg"
                  onClick={handleSave}
                  style={{ background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)' }}
                >
                  <Save className="w-4 h-4 inline mr-1" /> Save Package
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {offering && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">Set Offer</h3>
              <button onClick={() => setOffering(null)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-slate-700 mb-1">Offer Price ($)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  value={offering.offerPrice / 100}
                  onChange={(event) => setOffering({ ...offering, offerPrice: centsFromDollars(parseFloat(event.target.value) || 0) })}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">Offer Label</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  value={offering.offerLabel}
                  onChange={(event) => setOffering({ ...offering, offerLabel: event.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">Ends At</label>
                <input
                  type="datetime-local"
                  value={offering.offerEndsAt ? offering.offerEndsAt.slice(0, 16) : ''}
                  onChange={(event) => setOffering({ ...offering, offerEndsAt: event.target.value ? new Date(event.target.value).toISOString() : '' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button className="px-4 py-2 border border-slate-200 rounded-lg" onClick={() => setOffering(null)}>Cancel</button>
                <button
                  className="px-4 py-2 text-white rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)' }}
                  onClick={handleSetOffer}
                >Apply Offer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingId && moduleDetail && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">Package Detail</h3>
              <button onClick={() => setViewingId(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p><strong>Name:</strong> {moduleDetail.name}</p>
                  <p><strong>Description:</strong> {moduleDetail.description || '-'}</p>
                  <p><strong>Price:</strong> {formatPrice(moduleDetail.price, moduleDetail.currency)}</p>
                  <p><strong>Active:</strong> {moduleDetail.active ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="font-semibold mb-2">Users</p>
                  {moduleDetail.users.length === 0 ? <p className="text-slate-500">No users linked</p> : null}
                  {moduleDetail.users.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1">
                      {moduleDetail.users.map((user) => (
                        <li key={user.id} className="text-sm">
                          {user.firstName} {user.lastName} ({user.email})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div>
                <p className="font-semibold mb-2">Log</p>
                {moduleDetail.logs.length === 0 ? (
                  <div className="text-slate-500">No logs</div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left py-2 px-3 font-semibold">Time</th>
                          <th className="text-left py-2 px-3 font-semibold">Action</th>
                          <th className="text-left py-2 px-3 font-semibold">Actor</th>
                          <th className="text-left py-2 px-3 font-semibold">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {moduleDetail.logs.map((log) => (
                          <tr key={log.id} className="border-b border-slate-100">
                            <td className="py-2 px-3">{new Date(log.createdAt).toLocaleString()}</td>
                            <td className="py-2 px-3">{log.action}</td>
                            <td className="py-2 px-3">{log.actor}</td>
                            <td className="py-2 px-3">{log.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
