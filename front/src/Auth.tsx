import React, { useState } from "react";
import { Text, View } from "react-native";
import { api, ApiError } from "./api";
import { session } from "./storage";
import type { User } from "./types";
import { Back, Button, Field, Notice, styles } from "./ui";
export function Auth({
  onDone,
  onBack,
}: {
  onDone: (user: User) => void;
  onBack: () => void;
}) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  async function submit() {
    setError("");
    setFields({});
    setSuccess("");
    setBusy(true);
    try {
      if (register) {
        await api("/auth/registro", {
          nombre: name,
          correo: email,
          contrasena: password,
          confirmacion: confirmation,
        });
        setRegister(false);
        setSuccess(
          "Tu cuenta está creada. Ingresa con tu correo y contraseña.",
        );
        setConfirmation("");
      } else {
        const result = await api<{ token: string; usuario: User }>(
          "/auth/login",
          { correo: email, contrasena: password },
        );
        await session.set(result.token);
        onDone(result.usuario);
      }
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError) setFields(e.fields);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.page}>
      <Back onPress={onBack} />
      <View style={{ gap: 10 }}>
        <Text style={styles.title}>
          {register ? "Crea tu cuenta" : "Bienvenido a VoyBus"}
        </Text>
        <Text style={styles.subtitle}>
          {register
            ? "Regístrate como pasajero para solicitar tu parada."
            : "Ingresa para continuar tu viaje o abrir tu bandeja de conductor."}
        </Text>
      </View>
      {!!success && (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {success}
        </Text>
      )}
      <View style={{ gap: 18 }}>
        {register && (
          <Field
            label="Nombre"
            value={name}
            onChangeText={setName}
            error={fields.nombre}
            autoComplete="name"
            editable={!busy}
          />
        )}
        <Field
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          error={fields.correo}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          editable={!busy}
          placeholder="nombre@correo.cl"
        />
        <Field
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          error={fields.contrasena}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={register ? "new-password" : "current-password"}
          editable={!busy}
          onSubmitEditing={() => {
            if (!register) void submit();
          }}
        />
        {register && (
          <>
            <Text style={styles.small}>
              Entre 8 y 64 caracteres. No reutilices contraseñas de otros
              servicios.
            </Text>
            <Field
              label="Confirmar contraseña"
              value={confirmation}
              onChangeText={setConfirmation}
              error={fields.confirmacion}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
          </>
        )}
        <Button
          title={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          onPress={() => setShow(!show)}
          secondary
          disabled={busy}
        />
        {!!error && <Notice message={error} />}
        <Button
          title={register ? "Crear cuenta de pasajero" : "Ingresar"}
          onPress={() => void submit()}
          busy={busy}
        />
        <Button
          title={register ? "Ya tengo una cuenta" : "Crear una cuenta"}
          secondary
          disabled={busy}
          onPress={() => {
            setRegister(!register);
            setError("");
            setFields({});
            setSuccess("");
          }}
        />
      </View>
      <Text style={styles.small}>
        Puedes consultar los recorridos sin iniciar sesión.
      </Text>
    </View>
  );
}
