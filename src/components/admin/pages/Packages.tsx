import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  ADMIN_MODULES_QUERY,
  ADMIN_SAVE_MODULE_MUTATION,
  ADMIN_SET_MODULE_OFFER_MUTATION,
  ADMIN_MODULES_QUERY as REFETCH_QUERY
} from '../../../lib/graphql';
import { formatPrice, centsFromDollars } from '../../../lib/admin-utils';
import { Plus, Edit2, X, Save, Trash2, Tag } from 'lucide-react';

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
  offerActive: boolean;
  effectivePrice: number;
}

export const Packages: React.FC<{onToast: (type: 'success'|'error', msg: string) => void}> = ({onToast}) => {
  const { data, loading, error, refetch } = useQuery<{adminModules: ModuleType[]}, {includeInactive: boolean}, any>(ADMIN_MODULES_QUERY, {
    variables: { includeInactive: true }
  });

  const [editing, setEditing] = useState<EditingModule | null>(null);
  const [offering, setOffering] = useState<OfferingModule | null>(null);
  const [newModule, setNewModule] = useState(false);

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
          sortOrder: editing.sortOrder
        }
      });
      onToast('success', `Module "${editing.name}" saved`);
      setEditing(null);
      refetch();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to save module');
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
          offerEndsAt: offering.offerEndsAt || null
        }
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
        variables: { id, clear: true }
      });
      onToast('success', 'Offer cleared');
      refetch();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to clear offer');
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500">Loading packages...</div>;
  if (error) return <div className="text-center py-12 text-red-600">Error: {error.message}</div>;

  const modules = data?.adminModules || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Packages</h2>
          <p className="text-slate-600">Manage pricing, offers, and module availability</p>
        </div>
        <button
          onClick={() => {
            setNewModule(true);
            setEditing({
              id: `module_${Date.now()}`,
              name: '',
              description: '',
              price: 1000,
              currency: 'USD',
              active: true,
              sortOrder: modules.length + 1
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

      {/* Editing Form */}
      {editing && (
        <div className="border-2 rounded-2xl p-8 space-y-4 backdrop-blur-md" style={{
          background: 'linear-gradient(135deg, rgba(232, 252, 249, 0.9) 0%, rgba(225, 245, 254, 0.9) 100%)',
          borderColor: 'rgba(0, 203, 214, 0.3)',
          boxShadow: '0 8px 24px rgba(0, 203, 214, 0.15)'
        }}>
          <h3 className="font-bold text-lg" style={{color: '#00cbd6'}}>
            {newModule ? 'Create New Package' : 'Edit Package'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ID (key)</label>
              <input
                type="text"
                value={editing.id}
                disabled={!newModule}
                onChange={(e) => setEditing({...editing, id: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100"
                placeholder="employee_management"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({...editing, name: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price ($)</label>
              <input
                type="number"
                value={editing.price / 100}
                onChange={(e) => setEditing({...editing, price: centsFromDollars(parseFloat(e.target.value) || 0)})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
              <input
                type="text"
                value={editing.currency}
                onChange={(e) => setEditing({...editing, currency: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={editing.description}
                onChange={(e) => setEditing({...editing, description: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                rows={2}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 py-2">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({...editing, active: e.target.checked})}
                  className="rounded"
                />
                Active
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
              <input
                type="number"
                value={editing.sortOrder}
                onChange={(e) => setEditing({...editing, sortOrder: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setEditing(null);
                setNewModule(false);
              }}
              className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 text-white rounded-xl font-bold transition-all hover:scale-105 hover:shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(0, 203, 214, 0.3)'
              }}
            >
              <Save className="w-4 h-4" />
              Save Package
            </button>
          </div>
        </div>
      )}

      {/* Modules Table */}
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
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Offer</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Status</th>
                  <th className="text-right py-4 px-6 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((module: any) => (
                  <tr key={module.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-800">{module.name}</div>
                      <div className="text-sm text-slate-500">{module.description}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        {module.offerActive && (
                          <span className="line-through text-slate-400 text-sm">{formatPrice(module.price, module.currency)}</span>
                        )}
                        <div className={module.offerActive ? 'text-emerald-600 font-semibold' : ''}>
                          {formatPrice(module.effectivePrice, module.currency)}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {module.offerActive ? (
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-700">{module.offerLabel}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        module.active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {module.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
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
                              sortOrder: module.sortOrder || 0
                            });
                          }}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setOffering({
                            id: module.id,
                            offerPrice: module.offerPrice || module.price,
                            offerLabel: module.offerLabel || '',
                            offerEndsAt: module.offerEndsAt || ''
                          })}
                          className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                        >
                          <Tag className="w-4 h-4" />
                        </button>
                        {module.offerActive && (
                          <button
                            onClick={() => handleClearOffer(module.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Offer Editor Modal */}
      {offering && (
        <div className="border-2 rounded-2xl p-8 space-y-4 backdrop-blur-md" style={{
          background: 'linear-gradient(135deg, rgba(232, 252, 249, 0.9) 0%, rgba(230, 245, 250, 0.9) 100%)',
          borderColor: 'rgba(0, 203, 214, 0.3)',
          boxShadow: '0 8px 24px rgba(0, 203, 214, 0.15)'
        }}>
          <h3 className="font-bold text-lg" style={{color: '#00cbd6'}}>Set Offer</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Offer Price ($)</label>
              <input
                type="number"
                value={offering.offerPrice / 100}
                onChange={(e) => setOffering({...offering, offerPrice: centsFromDollars(parseFloat(e.target.value) || 0)})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Label (e.g., "Launch offer")</label>
              <input
                type="text"
                value={offering.offerLabel}
                onChange={(e) => setOffering({...offering, offerLabel: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Ends At (ISO-8601, optional)</label>
              <input
                type="datetime-local"
                value={offering.offerEndsAt.slice(0, 16)}
                onChange={(e) => setOffering({...offering, offerEndsAt: e.target.value ? new Date(e.target.value).toISOString() : ''})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setOffering(null)}
              className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSetOffer}
              className="flex items-center gap-2 px-6 py-2 text-white rounded-xl font-bold transition-all hover:scale-105 hover:shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(0, 203, 214, 0.3)'
              }}
            >
              <Tag className="w-4 h-4" />
              Apply Offer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
