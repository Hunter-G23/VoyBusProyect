import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useResource } from "./useResource";
import type { Line, Route, Stop } from "./types";
import {
  Back,
  Button,
  colors,
  Empty,
  Icon,
  Loading,
  Notice,
  styles,
} from "./ui";
export function Catalog({ onTrip }: { onTrip: () => void }) {
  const [line, setLine] = useState<Line | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const path = route
    ? `/red/recorridos/${route.id}/paraderos`
    : line
      ? `/red/lineas/${line.id}/recorridos`
      : "/red/lineas";
  const resource = useResource<{
    lineas?: Line[];
    recorridos?: Route[];
    paraderos?: Stop[];
  }>(path);
  return (
    <View style={styles.page}>
      {(line || route) && (
        <Back
          label={route ? "Recorridos de " + line?.codigo : "Todas las líneas"}
          onPress={() => (route ? setRoute(null) : setLine(null))}
        />
      )}
      <View style={{ gap: 9 }}>
        <Text style={styles.title}>
          {route ? route.nombre : line ? line.nombre : "Encuentra tu recorrido"}
        </Text>
        <Text style={styles.subtitle}>
          {route
            ? `${line?.codigo} · ${route.sentido}. Paraderos en orden de paso.`
            : line
              ? "Elige el sentido en el que quieres viajar."
              : "Consulta líneas y paraderos antes de subir al bus."}
        </Text>
      </View>
      {resource.loading && !resource.data && <Loading />}
      {!!resource.error && (
        <Notice
          message={resource.error}
          retry={() => void resource.reload()}
          stale={!!resource.data}
        />
      )}
      {resource.data && (
        <View style={styles.list}>
          {resource.data.lineas?.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.codigo}, ${item.nombre}`}
              onPress={() => setLine(item)}
              style={({ pressed }) => [
                styles.listRow,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.code}>{item.codigo}</Text>
              <View style={styles.grow}>
                <Text style={[styles.body, { fontWeight: "700" }]}>
                  {item.nombre}
                </Text>
                <Text style={styles.small}>Ver recorridos y paraderos</Text>
              </View>
              <Icon name="chevron-forward" />
            </Pressable>
          ))}
          {resource.data.recorridos?.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => setRoute(item)}
              style={({ pressed }) => [
                styles.listRow,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Icon name="swap-vertical-outline" color={colors.green} />
              <View style={styles.grow}>
                <Text style={[styles.body, { fontWeight: "700" }]}>
                  {item.sentido}
                </Text>
                <Text style={styles.body}>
                  {item.origen} → {item.destino}
                </Text>
                <Text style={styles.small}>{item.nombre}</Text>
              </View>
              <Icon name="chevron-forward" />
            </Pressable>
          ))}
          {resource.data.paraderos?.map((stop, index) => (
            <View
              key={stop.id}
              style={[styles.listRow, { alignItems: "flex-start" }]}
            >
              <View style={{ width: 30, alignItems: "center", gap: 6 }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: index === 0 ? colors.green : colors.yellow,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: index === 0 ? "white" : colors.ink,
                    }}
                  >
                    {stop.posicion}
                  </Text>
                </View>
              </View>
              <View style={styles.grow}>
                <Text style={[styles.body, { fontWeight: "700" }]}>
                  {stop.nombre}
                </Text>
                <Text style={styles.small}>
                  {stop.codigo} · {stop.latitud.toFixed(5)},{" "}
                  {stop.longitud.toFixed(5)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      {resource.data &&
        (resource.data.lineas?.length === 0 ||
          resource.data.recorridos?.length === 0 ||
          resource.data.paraderos?.length === 0) && (
          <Empty
            title="Sin opciones disponibles"
            text="No hay información disponible para esta selección en este momento."
          />
        )}
      {route && (
        <View style={{ gap: 12, paddingTop: 8 }}>
          <Text style={styles.subtitle}>
            ¿Ya estás a bordo? Vincula tu vehículo para solicitar tu parada.
          </Text>
          <Button title="Ir a mi viaje" onPress={onTrip} />
        </View>
      )}
    </View>
  );
}
