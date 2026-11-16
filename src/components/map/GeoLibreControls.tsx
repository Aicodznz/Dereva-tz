import React, { useState } from 'react';
import {
  Layers,
  Satellite,
  Moon,
  Map as MapIcon,
  Wifi,
  Store,
  Car,
  Flame,
  Shield,
  Bus,
  Building2,
  X,
  Plus,
  Check,
  Globe,
  Sun,
} from 'lucide-react';
import {
  GeoLibreBasemapId,
  GEOLIBRE_BASEMAPS,
  MapProjectionMode,
  MapboxLightPreset,
} from '../../lib/geoLibreEngine';

export interface GeoLibreLayerState {
  showVendors: boolean;
  openVendorsOnly: boolean;
  showDrivers: boolean;
  showHeatmap: boolean;
  showGeofences: boolean;
  showDaladalaRoutes: boolean;
  show3DBuildings: boolean;
}

export interface GeoLibreLayerCounts {
  openVendors?: number;
  closedVendors?: number;
  onlineDrivers?: number;
  busyDrivers?: number;
  geofenceCount?: number;
  daladalaRoutes?: number;
}

interface GeoLibreControlDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  basemap: GeoLibreBasemapId;
  onBasemapChange: (id: GeoLibreBasemapId) => void;
  layers: GeoLibreLayerState;
  onToggleLayer: (key: keyof GeoLibreLayerState) => void;
  counts?: GeoLibreLayerCounts;
  customOverlayUrl?: string;
  onLoadCustomOverlay?: (url: string) => void;
  onClearCustomOverlay?: () => void;
  projection?: MapProjectionMode;
  onProjectionChange?: (mode: MapProjectionMode) => void;
  lightPreset?: MapboxLightPreset;
  onLightPresetChange?: (preset: MapboxLightPreset) => void;
  isMapboxEnabled?: boolean;
}

const BASEMAP_ORDER: { id: GeoLibreBasemapId; icon: React.FC<{ className?: string }> }[] = [
  { id: 'street_3d', icon: MapIcon },
  { id: 'satellite', icon: Satellite },
  { id: 'night', icon: Moon },
  { id: 'lite', icon: Wifi },
];

export const GeoLibreBasemapPillBar: React.FC<{
  basemap: GeoLibreBasemapId;
  onChange: (id: GeoLibreBasemapId) => void;
  compact?: boolean;
}> = ({ basemap, onChange, compact = false }) => {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-neutral-950/85 backdrop-blur-md border border-white/15 shadow-lg">
      {BASEMAP_ORDER.map(({ id, icon: Icon }) => {
        const cfg = GEOLIBRE_BASEMAPS[id];
        const active = basemap === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              active
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-neutral-300 hover:text-white hover:bg-white/10'
            }`}
            title={cfg.name}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {!compact && <span>{cfg.shortLabel}</span>}
          </button>
        );
      })}
    </div>
  );
};

export const GeoLibreControlDrawer: React.FC<GeoLibreControlDrawerProps> = ({
  isOpen,
  onClose,
  basemap,
  onBasemapChange,
  layers,
  onToggleLayer,
  counts = {},
  customOverlayUrl,
  onLoadCustomOverlay,
  onClearCustomOverlay,
  projection = 'globe',
  onProjectionChange,
  lightPreset = 'day',
  onLightPresetChange,
  isMapboxEnabled = false,
}) => {
  const [urlInput, setUrlInput] = useState(customOverlayUrl || '');

  if (!isOpen) return null;

  const layerItems: {
    key: keyof GeoLibreLayerState;
    label: string;
    sublabel: string;
    icon: React.FC<{ className?: string }>;
    accent: string;
    countLabel?: string;
  }[] = [
    {
      key: 'showVendors',
      label: 'Biashara & Maduka',
      sublabel: 'Pin za kijani (Wazi) na nyekundu (Imefungwa)',
      icon: Store,
      accent: 'text-emerald-400',
      countLabel:
        counts.openVendors !== undefined
          ? `${counts.openVendors} Wazi • ${counts.closedVendors || 0} Imefungwa`
          : undefined,
    },
    {
      key: 'openVendorsOnly',
      label: 'Onyesha Wazi Tu',
      sublabel: 'Ficha maduka yaliyofungwa kwa saa za Afrika Mashariki',
      icon: Check,
      accent: 'text-emerald-400',
    },
    {
      key: 'showDrivers',
      label: 'Madereva Live (Online / Busy)',
      sublabel: 'PapoRide Taxi, Boda, Bajaji & Delivery',
      icon: Car,
      accent: 'text-amber-400',
      countLabel:
        counts.onlineDrivers !== undefined
          ? `${counts.onlineDrivers} Online • ${counts.busyDrivers || 0} Busy`
          : undefined,
    },
    {
      key: 'showHeatmap',
      label: 'Ramani ya Joto & 3D Hotspots',
      sublabel: 'Maeneo yenye mahitaji makubwa na oda nyingi',
      icon: Flame,
      accent: 'text-rose-400',
    },
    {
      key: 'showDaladalaRoutes',
      label: 'Njia za Daladala & BRT',
      sublabel: 'Mwendokasi, vituo vikuu na nauli za njia',
      icon: Bus,
      accent: 'text-sky-400',
      countLabel: counts.daladalaRoutes ? `${counts.daladalaRoutes} Njia` : undefined,
    },
    {
      key: 'showGeofences',
      label: 'Mipaka ya Huduma (Geofence)',
      sublabel: 'Kanda za miji na mipaka ya bei za usafirishaji',
      icon: Shield,
      accent: 'text-orange-400',
      countLabel: counts.geofenceCount ? `${counts.geofenceCount} Kanda` : undefined,
    },
    {
      key: 'show3DBuildings',
      label: 'Majengo ya 3D (Extrusion)',
      sublabel: 'Majengo marefu na mitaa kwa mtazamo wa 3D',
      icon: Building2,
      accent: 'text-indigo-400',
    },
  ];

  return (
    <div className="fixed inset-0 z-[1050] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full sm:max-w-md bg-neutral-950 text-white rounded-t-3xl sm:rounded-2xl border border-white/15 shadow-2xl overflow-hidden max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight">
                GeoLibre Layer Manager
              </h3>
              <p className="text-[11px] text-neutral-400">
                Chagua mwonekano wa ramani na tabaka za taarifa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* 1. Basemap Switcher */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              Mwonekano wa Ramani (Basemap)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {BASEMAP_ORDER.map(({ id, icon: Icon }) => {
                const cfg = GEOLIBRE_BASEMAPS[id];
                const isSelected = basemap === id;
                const displayLabel =
                  isMapboxEnabled && id === 'street_3d'
                    ? 'Standard 3D'
                    : isMapboxEnabled && id === 'satellite'
                    ? 'Standard Satellite'
                    : isMapboxEnabled && id === 'night'
                    ? 'Dark'
                    : isMapboxEnabled && id === 'lite'
                    ? 'Light'
                    : cfg.shortLabel;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onBasemapChange(id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500/15 text-white'
                        : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-orange-400' : 'text-neutral-400'}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight truncate">{displayLabel}</div>
                      <div className="text-[10px] text-neutral-400 font-mono tabular-nums mt-0.5">
                        {isMapboxEnabled ? 'Mapbox GL' : `${cfg.tag} • ${cfg.dataRate}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1B. Projection (Globe / Mercator) & Lighting Preset */}
          {onProjectionChange && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                Projection (Mtazamo wa Dunia)
              </span>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'globe', label: 'Globe (3D Dunia)' },
                  { id: 'mercator', label: 'Mercator (Bapa)' },
                ] as const).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onProjectionChange(p.id)}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      projection === p.id
                        ? 'border-orange-500 bg-orange-500/15 text-white'
                        : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    <Globe className={`w-3.5 h-3.5 ${projection === p.id ? 'text-orange-400' : 'text-neutral-400'}`} />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isMapboxEnabled && onLightPresetChange && basemap === 'street_3d' && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                Mwanga wa Mtaa (Standard Lighting)
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { id: 'dawn', label: 'Asubuhi' },
                  { id: 'day', label: 'Mchana' },
                  { id: 'dusk', label: 'Jioni' },
                  { id: 'night', label: 'Usiku' },
                ] as const).map((lp) => (
                  <button
                    key={lp.id}
                    type="button"
                    onClick={() => onLightPresetChange(lp.id)}
                    className={`px-2 py-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      lightPreset === lp.id
                        ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                        : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    <Sun className="w-3 h-3 shrink-0" />
                    <span>{lp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Layer Toggles */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              Tabaka za Taarifa (Map Layers)
            </span>
            <div className="space-y-1.5">
              {layerItems.map((item) => {
                const Icon = item.icon;
                const enabled = layers[item.key];
                const disabled = item.key === 'openVendorsOnly' && !layers.showVendors;
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => onToggleLayer(item.key)}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      enabled
                        ? 'border-white/25 bg-white/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${enabled ? item.accent : 'text-neutral-500'}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white leading-tight">{item.label}</div>
                        <div className="text-[10px] text-neutral-400 mt-0.5 leading-snug">{item.sublabel}</div>
                        {item.countLabel && (
                          <div className="text-[10px] font-mono tabular-nums text-neutral-300 mt-1">
                            {item.countLabel}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className={`w-9 h-5 rounded-full transition-colors p-0.5 shrink-0 ${
                        enabled ? 'bg-orange-600' : 'bg-neutral-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Custom GeoJSON / PMTiles Data URL Overlay */}
          {onLoadCustomOverlay && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  Pakia Faili la Ramani (GeoJSON URL)
                </span>
                {customOverlayUrl && onClearCustomOverlay && (
                  <button
                    type="button"
                    onClick={() => {
                      setUrlInput('');
                      onClearCustomOverlay();
                    }}
                    className="text-[10px] font-bold text-rose-400 hover:underline cursor-pointer"
                  >
                    Ondoa
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://.../data.geojson"
                  className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/15 text-xs text-white placeholder:text-neutral-500 font-mono focus:outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (urlInput.trim()) onLoadCustomOverlay(urlInput.trim());
                  }}
                  className="h-9 px-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Weka</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
