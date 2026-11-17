import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import type { VehicleInCirculation } from "./types";
import { colors, Loading, Notice } from "./ui";

const source = {
  html: `<!doctype html>
<html lang="es">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.19.0/dist/maplibre-gl.css">
  <style>
    html, body, #map { margin: 0; width: 100%; height: 100%; background: ${colors.surface}; }
    .vehicle { border: 2px solid ${colors.ink}; border-radius: 8px; padding: 6px 8px; background: ${colors.green}; color: ${colors.paper}; font: 700 13px sans-serif; }
    .stale { border-style: dashed; background: ${colors.yellow}; color: ${colors.ink}; }
    .maplibregl-ctrl-attrib a { display: inline-flex; align-items: center; min-height: 48px; }
  </style>
</head>
<body>
  <div id="map" role="region" aria-label="Mapa de vehículos en circulación"></div>
  <script type="module">
    function send(message) { window.ReactNativeWebView.postMessage(message); }
    try {
        const maplibregl = await import('https://unpkg.com/maplibre-gl@6.19.0/dist/maplibre-gl.mjs');
        var map = new maplibregl.Map({
          container: 'map',
          style: 'https://tiles.openfreemap.org/styles/positron',
          center: [-70.39, -23.64], zoom: 13,
          attributionControl: { compact: false }
        });
        var markers = [];
        map.on('load', function () { send('loaded'); });
        map.on('error', function () { send('error'); });
        window.updateVehicles = function (vehicles) {
          markers.forEach(function (marker) { marker.remove(); });
          markers = [];
          var bounds = new maplibregl.LngLatBounds();
          vehicles.forEach(function (vehicle) {
            if (!vehicle.posicion) return;
            var position = vehicle.posicion;
            var element = document.createElement('div');
            element.className = 'vehicle' + (position.desactualizada ? ' stale' : '');
            element.textContent = vehicle.vehiculo;
            element.title = vehicle.vehiculo + ' · ' + vehicle.linea + ' · ' + vehicle.sentido + (position.desactualizada ? ' · Desactualizada (más de 30 s)' : '');
            markers.push(new maplibregl.Marker({ element: element }).setLngLat([position.longitud, position.latitud]).addTo(map));
            bounds.extend([position.longitud, position.latitud]);
          });
          if (bounds.isEmpty()) {
            map.jumpTo({ center: [-70.39, -23.64], zoom: 13 });
          } else {
            map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 });
          }
        };
        send('ready');
    } catch (error) { send('error'); }
  </script>
</body>
</html>`,
};

export function MapCanvas({ vehicles }: { vehicles: VehicleInCirculation[] }) {
  const webView = useRef<WebView<object>>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (ready) {
      webView.current?.injectJavaScript(
        `window.updateVehicles(${JSON.stringify(vehicles)}); true;`,
      );
    }
  }, [vehicles, ready]);
  function failed() {
    setLoading(false);
    setError(
      "No pudimos cargar el mapa. Revisa tu conexión o consulta la lista de vehículos.",
    );
  }
  return (
    <View style={{ gap: 10 }}>
      {loading && <Loading />}
      {!!error && (
        <Notice
          message={error}
          retry={() => {
            setReady(false);
            setLoading(true);
            setError("");
            setAttempt((value) => value + 1);
          }}
        />
      )}
      <View style={{ height: 320, backgroundColor: colors.surface }}>
        <WebView<object>
          key={attempt}
          ref={webView}
          source={source}
          originWhitelist={["*"]}
          scrollEnabled={false}
          onMessage={(event) => {
            const message = event.nativeEvent.data;
            if (message === "ready") setReady(true);
            if (message === "loaded") setLoading(false);
            if (message === "error") failed();
          }}
          onError={failed}
          style={{ backgroundColor: colors.surface }}
        />
      </View>
    </View>
  );
}
