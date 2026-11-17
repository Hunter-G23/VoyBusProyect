import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import {
  LngLatBounds,
  Map as LibreMap,
  Marker,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { VehicleInCirculation } from "./types";
import { colors, Loading, Notice } from "./ui";

export function MapCanvas({ vehicles }: { vehicles: VehicleInCirculation[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!container.current) return;
    let instance: LibreMap;
    try {
      // Metro does not emit MapLibre's module worker beside the web bundle.
      setWorkerUrl(
        "https://unpkg.com/maplibre-gl@6.19.0/dist/maplibre-gl-worker.mjs",
      );
      instance = new LibreMap({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [-70.39, -23.64],
        zoom: 13,
        attributionControl: { compact: false },
      });
    } catch {
      setLoading(false);
      setError(
        "No pudimos cargar el mapa. Revisa tu conexión o consulta la lista de vehículos.",
      );
      return;
    }
    map.current = instance;
    instance
      .getCanvas()
      .setAttribute(
        "aria-label",
        "Mapa de vehículos en circulación. Lista de posiciones debajo del mapa.",
      );
    instance.on("load", () => setLoading(false));
    instance.on("error", () => {
      setLoading(false);
      setError(
        "No pudimos cargar el mapa. Revisa tu conexión o consulta la lista de vehículos.",
      );
    });
    return () => {
      map.current = null;
      instance.remove();
    };
  }, [attempt]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const bounds = new LngLatBounds();
    const markers: Marker[] = [];
    for (const vehicle of vehicles) {
      if (!vehicle.posicion) continue;
      const { latitud, longitud, desactualizada } = vehicle.posicion;
      const element = document.createElement("div");
      element.textContent = vehicle.vehiculo;
      element.title = `${vehicle.vehiculo} · ${vehicle.linea} · ${vehicle.sentido}${desactualizada ? " · Desactualizada (más de 30 s)" : ""}`;
      Object.assign(element.style, {
        backgroundColor: desactualizada ? colors.yellow : colors.green,
        color: desactualizada ? colors.ink : colors.paper,
        border: `2px ${desactualizada ? "dashed" : "solid"} ${colors.ink}`,
        borderRadius: "8px",
        padding: "6px 8px",
        fontSize: "13px",
        fontWeight: "700",
      });
      markers.push(
        new Marker({ element }).setLngLat([longitud, latitud]).addTo(instance),
      );
      bounds.extend([longitud, latitud]);
    }
    if (bounds.isEmpty()) {
      instance.jumpTo({ center: [-70.39, -23.64], zoom: 13 });
    } else {
      instance.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 });
    }
    return () => markers.forEach((marker) => marker.remove());
  }, [vehicles, attempt]);

  return (
    <View style={{ gap: 10 }}>
      {loading && <Loading />}
      {!!error && (
        <Notice
          message={error}
          retry={() => {
            setError("");
            setLoading(true);
            setAttempt((value) => value + 1);
          }}
        />
      )}
      <style>{`
        .maplibregl-ctrl-attrib a { display: inline-flex; align-items: center; min-height: 48px; }
      `}</style>
      <div
        ref={container}
        role="region"
        aria-label="Mapa de vehículos en circulación"
        style={{ height: 320, width: "100%", backgroundColor: colors.surface }}
      />
    </View>
  );
}
