import type { Map as LibreMap } from 'maplibre-gl';
import type { ThemeScheme } from './theme';

export function mapPalette(scheme: ThemeScheme) {
  return scheme === 'dark'
    ? {
        land: '#141E27',
        water: '#132833',
        park: '#19282E',
        building: '#1D2B37',
        road: '#344656',
        roadMinor: '#273644',
        text: '#E6EDF3',
        textHalo: '#141E27',
      }
    : {
        land: '#F7F3E8',
        water: '#B2D9D9',
        park: '#DCE6D5',
        building: '#EAE4D5',
        road: '#FFFFFF',
        roadMinor: '#EDE8DA',
        text: '#1A2D36',
        textHalo: '#F7F3E8',
      };
}

export type MapLayerLike = {
  id: string;
  type?: string;
  'source-layer'?: string;
  layout?: Record<string, unknown>;
};

export type MapStyleLike = {
  getStyle: () => { layers?: MapLayerLike[] } | undefined;
  setPaintProperty: (layerId: string, name: string, value: unknown) => void;
};

export function applyMapPalette(map: LibreMap | MapStyleLike, scheme: ThemeScheme) {
  const palette = mapPalette(scheme);
  const styleMap = map as MapStyleLike;
  const layers = styleMap.getStyle()?.layers ?? [];
  for (const layer of layers) {
    const id = layer.id.toLowerCase();
    const sourceLayer = (layer['source-layer'] ?? '').toLowerCase();
    try {
      if (layer.type === 'background') {
        styleMap.setPaintProperty(layer.id, 'background-color', palette.land);
      } else if (id.includes('water') || sourceLayer === 'water') {
        if (layer.type === 'fill') styleMap.setPaintProperty(layer.id, 'fill-color', palette.water);
        if (layer.type === 'line') styleMap.setPaintProperty(layer.id, 'line-color', palette.water);
      } else if (layer.type === 'fill' && (id.includes('building') || sourceLayer === 'building')) {
        styleMap.setPaintProperty(layer.id, 'fill-color', palette.building);
      } else if (layer.type === 'fill' && (id.includes('park') || id.includes('green') || id.includes('grass'))) {
        styleMap.setPaintProperty(layer.id, 'fill-color', palette.park);
      } else if (layer.type === 'line' && (sourceLayer === 'transportation' || id.includes('road') || id.includes('highway') || id.includes('street'))) {
        if (!id.includes('casing')) {
          styleMap.setPaintProperty(layer.id, 'line-color', id.includes('minor') || id.includes('service') ? palette.roadMinor : palette.road);
        }
      } else if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
        styleMap.setPaintProperty(layer.id, 'text-color', palette.text);
        styleMap.setPaintProperty(layer.id, 'text-halo-color', palette.textHalo);
      }
    } catch {
      // Ignore layer properties unsupported by the active remote style.
    }
  }
}

export function mapPaletteScript(scheme: ThemeScheme) {
  const palette = JSON.stringify(mapPalette(scheme));
  return `function applyPalette(map){const p=${palette};const layers=(map.getStyle()&&map.getStyle().layers)||[];for(const l of layers){const id=(l.id||'').toLowerCase();const sl=(l['source-layer']||'').toLowerCase();try{if(l.type==='background'){map.setPaintProperty(l.id,'background-color',p.land);}else if(id.includes('water')||sl==='water'){if(l.type==='fill')map.setPaintProperty(l.id,'fill-color',p.water);if(l.type==='line')map.setPaintProperty(l.id,'line-color',p.water);}else if(l.type==='fill'&&(id.includes('building')||sl==='building')){map.setPaintProperty(l.id,'fill-color',p.building);}else if(l.type==='fill'&&(id.includes('park')||id.includes('green')||id.includes('grass'))){map.setPaintProperty(l.id,'fill-color',p.park);}else if(l.type==='line'&&(sl==='transportation'||id.includes('road')||id.includes('highway')||id.includes('street'))){if(!id.includes('casing'))map.setPaintProperty(l.id,'line-color',id.includes('minor')||id.includes('service')?p.roadMinor:p.road);}else if(l.type==='symbol'&&l.layout&&'text-field' in l.layout){map.setPaintProperty(l.id,'text-color',p.text);map.setPaintProperty(l.id,'text-halo-color',p.textHalo);}}catch{}}}`;
}
