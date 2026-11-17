import React from "react";
import { Text, View } from "react-native";
import { MapCanvas } from "./MapCanvas";
import type { VehiclesResponse } from "./types";
import { useResource } from "./useResource";
import { colors, Empty, Icon, Loading, Notice, styles } from "./ui";

export function VehicleMap() {
  const resource = useResource<VehiclesResponse>("/red/vehiculos", true);
  return (
    <View style={styles.page}>
      <View style={{ gap: 9 }}>
        <Text style={styles.title}>Vehículos en circulación</Text>
        <Text style={styles.subtitle}>
          Consulta la última posición y hora de medición de cada vehículo.
        </Text>
      </View>
      {!resource.data && !resource.error && <Loading />}
      {!!resource.error && (
        <Notice
          message={resource.error}
          retry={() => void resource.reload()}
          stale={!!resource.data}
        />
      )}
      {resource.data && (
        <>
          {resource.data.fuente === "simulacion" && (
            <Notice message="Posiciones simuladas: no corresponden a GPS real." />
          )}
          <MapCanvas vehicles={resource.data.vehiculos} />
          {resource.data.vehiculos.length === 0 ? (
            <Empty
              title="No hay vehículos en circulación."
              text="La información se actualiza automáticamente mientras esta pantalla está visible."
            />
          ) : (
            <View style={{ gap: 12 }}>
              <Text style={styles.section}>Posiciones por vehículo</Text>
              <Text style={styles.small}>
                Hora local de la última medición. Las posiciones antiguas se
                muestran en amarillo y con borde discontinuo en el mapa.
              </Text>
              <View style={styles.list}>
                {resource.data.vehiculos.map((item) => (
                  <View
                    key={item.servicio_id}
                    style={[styles.listRow, { alignItems: "flex-start" }]}
                  >
                    <Icon name="bus-outline" color={colors.green} />
                    <View style={styles.grow}>
                      <Text style={[styles.body, { fontWeight: "700" }]}>
                        {item.vehiculo} · Línea {item.linea}
                      </Text>
                      <Text style={styles.body}>Sentido: {item.sentido}</Text>
                      {item.posicion ? (
                        <>
                          <Text style={styles.small}>
                            Medición:{" "}
                            {new Date(
                              item.posicion.medida_en,
                            ).toLocaleTimeString("es-CL")}
                          </Text>
                          {item.posicion.desactualizada && (
                            <Text
                              style={[styles.body, { color: colors.error }]}
                            >
                              Desactualizada (más de 30 s)
                            </Text>
                          )}
                        </>
                      ) : (
                        <Text style={styles.small}>Sin datos de posición</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}
