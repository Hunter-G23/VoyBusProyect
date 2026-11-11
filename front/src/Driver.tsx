import React from "react";
import { Text, View } from "react-native";
import { useResource } from "./useResource";
import type { Inbox } from "./types";
import { Button, colors, Empty, Icon, Loading, Notice, styles } from "./ui";
export function Driver() {
  const inbox = useResource<Inbox>("/conductor/servicio/solicitudes", true);
  const service = inbox.data?.servicio;
  return (
    <View style={styles.page}>
      <View style={{ gap: 10 }}>
        <Text style={styles.title}>Solicitudes de parada</Text>
        <Text style={styles.subtitle}>
          Consulta esta bandeja con el vehículo detenido.
        </Text>
      </View>
      {inbox.loading && !inbox.data && <Loading />}
      {!!inbox.error && (
        <Notice
          message={inbox.error}
          retry={() => void inbox.reload()}
          stale={!!inbox.data}
        />
      )}
      {service && (
        <View style={[styles.panel, { backgroundColor: colors.ink }]}>
          <View style={styles.row}>
            <Icon name="bus-outline" color={colors.yellow} size={30} />
            <Text style={{ fontSize: 26, fontWeight: "700", color: "white" }}>
              {service.codigo_vinculacion}
            </Text>
          </View>
          <Text style={{ fontSize: 17, color: "white" }}>
            {service.linea} · {service.sentido}
          </Text>
          <Text style={{ fontSize: 15, color: "#D6E8DE" }}>
            {service.recorrido} · {service.patente}
          </Text>
        </View>
      )}
      {inbox.data && !service && (
        <Empty
          title="Sin servicio asignado"
          text="Tu cuenta no tiene un servicio activo. No se mostrarán solicitudes de otros vehículos."
        />
      )}
      {service && (
        <>
          <View style={styles.row}>
            <Text style={[styles.section, styles.grow]}>Próximos destinos</Text>
            <Text style={styles.small}>
              {inbox.data?.solicitudes.length} solicitudes
            </Text>
          </View>
          {!inbox.data?.paraderos.length ? (
            <Empty
              title="Aún no hay solicitudes"
              text="Las solicitudes de tus pasajeros aparecerán aquí al ser guardadas por el servidor."
            />
          ) : (
            <View style={styles.list}>
              {inbox.data.paraderos.map((stop) => (
                <View key={stop.destino_id} style={styles.listRow}>
                  <Icon name="location-outline" color={colors.green} />
                  <View style={styles.grow}>
                    <Text style={[styles.body, { fontWeight: "700" }]}>
                      {stop.nombre}
                    </Text>
                    <Text style={styles.small}>
                      {stop.codigo} · Paradero {stop.posicion}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "700",
                      color: colors.green,
                    }}
                    accessibilityLabel={`${stop.cantidad} solicitudes`}
                  >
                    {stop.cantidad}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {!!inbox.data?.solicitudes.length && (
            <View style={{ gap: 8 }}>
              <Text style={styles.section}>Comprobantes recibidos</Text>
              {inbox.data.solicitudes.map((item) => (
                <View key={item.id} style={styles.listRow}>
                  <Text style={styles.code}>#{item.id}</Text>
                  <View style={styles.grow}>
                    <Text style={styles.body}>{item.paradero}</Text>
                    <Text style={styles.small}>
                      {item.estado === "pendiente" ? "Pendiente" : "Reconocida"}{" "}
                      · {new Date(item.creada_en).toLocaleTimeString("es-CL")}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          <Button
            title="Actualizar bandeja"
            onPress={() => void inbox.reload()}
            busy={inbox.loading}
            secondary
          />
          <Text style={styles.small}>
            {inbox.updated
              ? `Última consulta: ${inbox.updated.toLocaleTimeString("es-CL")}. `
              : ""}
            Se actualiza cada 5 segundos mientras está abierta. Consultar no
            reconoce ni atiende solicitudes.
          </Text>
        </>
      )}
    </View>
  );
}
