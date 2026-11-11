import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { api, ApiError } from "./api";
import { storage } from "./storage";
import { useResource } from "./useResource";
import type { Attempt, CurrentTrip, Request, Stop, User } from "./types";
import {
  Button,
  colors,
  Empty,
  Field,
  Icon,
  Loading,
  Notice,
  styles,
} from "./ui";
const stateLabel: Record<Request["estado"], string> = {
  pendiente: "Solicitud enviada",
  reconocida: "Reconocida por el conductor",
  atendida: "Solicitud atendida",
  cancelada: "Solicitud cancelada",
  expirada: "Solicitud expirada",
};
export function Trip({
  user,
  onLogin,
}: {
  user: User | null;
  onLogin: () => void;
}) {
  if (!user)
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Tu próxima parada, a un toque</Text>
        <Text style={styles.subtitle}>
          Cuando estés a bordo, ingresa el código del bus y elige dónde quieres
          bajar.
        </Text>
        <View style={styles.panel}>
          <Icon name="bus-outline" size={40} color={colors.green} />
          <Text style={styles.section}>Viaja con tu cuenta</Text>
          <Text style={styles.body}>
            Así podrás consultar tu solicitud y mantenerla vinculada a tu viaje.
          </Text>
          <Button title="Ingresar o crear cuenta" onPress={onLogin} />
        </View>
      </View>
    );
  if (user.rol !== "pasajero")
    return (
      <View style={styles.page}>
        <Empty
          title="Vista de pasajero"
          text="Esta función está disponible para cuentas de pasajero. Puedes consultar la red desde Recorridos."
        />
      </View>
    );
  return <PassengerTrip key={user.id} user={user} />;
}
function PassengerTrip({ user }: { user: User }) {
  const current = useResource<CurrentTrip>("/viaje/actual");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [ready, setReady] = useState(false);
  const lock = useRef(false);
  const storageKey = `voybus-attempt-${user.id}`;
  const link = current.data?.vinculo;
  const stops = useResource<{ paraderos: Stop[] }>(
    link ? `/red/recorridos/${link.recorrido_id}/paraderos` : null,
  );
  const initialReceipt = current.data?.solicitud;
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const receipt = useResource<{ solicitud: Request }>(
    receiptId ? `/viaje/solicitudes/${receiptId}` : null,
    true,
  );
  const request = receipt.data?.solicitud || initialReceipt;
  const hasActive =
    !!request && ["pendiente", "reconocida"].includes(request.estado);
  useEffect(() => {
    if (initialReceipt) setReceiptId(initialReceipt.id);
  }, [initialReceipt?.id]);
  useEffect(() => {
    if (attempt && request?.clave_idempotencia === attempt.clave_idempotencia) {
      storage
        .remove(storageKey)
        .then(() => setAttempt(null))
        .catch(() =>
          setError(
            "La solicitud está confirmada, pero no pudimos limpiar el intento local.",
          ),
        );
    }
  }, [attempt, request?.clave_idempotencia, storageKey]);
  useEffect(() => {
    let active = true;
    storage
      .get(storageKey)
      .then((value) => {
        if (!active) return;
        if (value) {
          try {
            const data = JSON.parse(value) as Attempt;
            if (
              typeof data.clave_idempotencia === "string" &&
              Number.isInteger(data.destino_id)
            ) {
              setAttempt(data);
              setSelected(data.destino_id);
            }
          } catch {
            /* Invalid local attempt is ignored; no request is sent automatically. */
          }
        }
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setReady(true);
          setError(
            "No pudimos recuperar el intento local. Comprueba tu viaje antes de enviar.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [storageKey]);
  async function linkVehicle() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api("/viaje/vincular", { codigo_vehiculo: code });
      await current.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function send() {
    if (lock.current || !selected || !ready) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const intent = attempt || {
        destino_id: selected,
        clave_idempotencia: Crypto.randomUUID(),
      };
      await storage.set(storageKey, JSON.stringify(intent));
      setAttempt(intent);
      const result = await api<{ solicitud: Request }>(
        "/viaje/solicitudes",
        intent,
      );
      setReceiptId(result.solicitud.id);
      await storage.remove(storageKey);
      setAttempt(null);
      await current.reload();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status !== 0) {
        // A definitive server rejection is not an uncertain delivery. Let the user correct it.
        if (e.status < 500) {
          await storage.remove(storageKey).catch(() => {});
          setAttempt(null);
          await current.reload();
        }
      }
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const selectedStop = stops.data?.paraderos.find((x) => x.id === selected);
  return (
    <View style={styles.page}>
      <View style={{ gap: 9 }}>
        <Text style={styles.title}>Mi viaje</Text>
        <Text style={styles.subtitle}>
          {link
            ? "Tu solicitud viaja con el servicio de este bus."
            : "Ingresa el código visible en el bus cuando estés a bordo."}
        </Text>
      </View>
      {current.loading && !current.data && <Loading />}
      {!!current.error && (
        <Notice
          message={current.error}
          retry={() => void current.reload()}
          stale={!!current.data}
        />
      )}
      {current.data && !link && (
        <View style={styles.panel}>
          <View style={styles.row}>
            <Icon name="bus-outline" size={30} color={colors.green} />
            <Text style={styles.section}>Vincula tu vehículo</Text>
          </View>
          <Field
            label="Código del vehículo"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Por ejemplo, BUS001"
            editable={!busy}
          />
          <Button
            title="Vincular vehículo"
            onPress={() => void linkVehicle()}
            busy={busy}
          />
        </View>
      )}
      {link && (
        <>
          <View style={[styles.panel, { backgroundColor: colors.ink }]}>
            <View style={styles.row}>
              <Icon name="bus-outline" size={30} color={colors.yellow} />
              <Text style={{ fontSize: 26, fontWeight: "700", color: "white" }}>
                {link.codigo_vinculacion}
              </Text>
            </View>
            <Text style={{ fontSize: 17, lineHeight: 25, color: "white" }}>
              {link.linea} · {link.recorrido}
            </Text>
            <Text style={{ fontSize: 15, color: "#D6E8DE" }}>
              {link.sentido} · Patente {link.patente}
            </Text>
          </View>
          {request && (
            <View style={styles.panel} accessibilityLiveRegion="polite">
              <View style={styles.row}>
                <Icon
                  name={
                    hasActive ? "checkmark-circle-outline" : "receipt-outline"
                  }
                  color={colors.green}
                />
                <Text style={[styles.section, { flex: 1 }]}>
                  {stateLabel[request.estado]}
                </Text>
              </View>
              <Text style={styles.body}>
                Destino: {request.paradero} · {request.paradero_codigo}
              </Text>
              <Text style={styles.small}>
                Solicitud #{request.id} ·{" "}
                {new Date(request.actualizada_en).toLocaleString("es-CL")}
              </Text>
              <Text style={styles.body}>
                {request.estado === "pendiente"
                  ? "Tu solicitud está guardada. Aún no ha sido reconocida por el conductor."
                  : "Este es el último estado registrado por el servidor."}
              </Text>
              {!!receipt.error && <Notice message={receipt.error} stale />}
              <Button
                title="Actualizar seguimiento"
                onPress={() => void receipt.reload()}
                busy={receipt.loading}
                secondary
              />
              <Text style={styles.small}>
                Se actualiza cada 5 segundos mientras esta pantalla está
                abierta.
              </Text>
            </View>
          )}
          {link.servicio_estado !== "activo" ? (
            <Empty
              title="El servicio finalizó"
              text="Puedes consultar tu comprobante. No se pueden enviar nuevas solicitudes a este servicio."
            />
          ) : (
            !hasActive && (
              <>
                <View style={{ gap: 7 }}>
                  <Text style={styles.section}>¿Dónde quieres bajar?</Text>
                  <Text style={styles.subtitle}>
                    Selecciona un paradero que aún no haya pasado.
                  </Text>
                </View>
                {stops.loading && !stops.data && <Loading />}
                {!!stops.error && (
                  <Notice
                    message={stops.error}
                    retry={() => void stops.reload()}
                    stale={!!stops.data}
                  />
                )}
                <View style={styles.list}>
                  {stops.data?.paraderos.map((stop) => {
                    const passed = stop.posicion <= link.ultima_posicion;
                    const active = selected === stop.id;
                    const disabled = passed || busy || !!attempt;
                    return (
                      <Pressable
                        key={stop.id}
                        accessibilityRole="radio"
                        accessibilityLabel={`${stop.codigo}, ${stop.nombre}${passed ? ", ya pasó" : ""}`}
                        accessibilityState={{ checked: active, disabled }}
                        disabled={disabled}
                        onPress={() => setSelected(stop.id)}
                        style={[styles.listRow, { opacity: passed ? 0.5 : 1 }]}
                      >
                        <Icon
                          name={
                            passed
                              ? "checkmark-circle-outline"
                              : active
                                ? "radio-button-on"
                                : "radio-button-off"
                          }
                          color={active ? colors.green : colors.muted}
                        />
                        <View style={styles.grow}>
                          <Text
                            style={[
                              styles.body,
                              { fontWeight: active ? "700" : "500" },
                            ]}
                          >
                            {stop.nombre}
                          </Text>
                          <Text style={styles.small}>
                            {stop.codigo} ·{" "}
                            {passed ? "Ya pasó" : "Paradero " + stop.posicion}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                {attempt && (
                  <Text style={styles.body}>
                    Hay un envío sin confirmar. Al reintentar se conserva el
                    mismo destino y no se duplica la solicitud.
                  </Text>
                )}
                <Button
                  title={
                    attempt
                      ? "Reintentar envío"
                      : selectedStop
                        ? `Solicitar parada en ${selectedStop.nombre}`
                        : "Selecciona tu paradero"
                  }
                  onPress={() => void send()}
                  busy={busy}
                  disabled={!selected || !ready || !!stops.error}
                />
              </>
            )
          )}
        </>
      )}
      {!!error && <Notice message={error} />}
      {attempt && (
        <Button
          title="Comprobar mi viaje"
          onPress={() => void current.reload()}
          secondary
          busy={current.loading}
        />
      )}
    </View>
  );
}
