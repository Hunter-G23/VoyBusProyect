import React, { useEffect, useState } from "react";
import { Animated, Text, View } from "react-native";
import type { Line, LineStatus, Route, Stop, User } from "./types";
import { useResource } from "./useResource";
import { Back, Button, Empty, FavoriteButton, LinePlate, Loading, Notice, Segmented, useStyles } from "./ui";
import { useLanguage } from "./i18n";
import "./i18n/lines";
import { useListEntrance } from "./motion";
import { addFavorite, removeFavorite, useFavorites } from "./favorites";

export type LinesProps = { onTrip: () => void; user?: User | null; onLogin?: () => void; selectedLine?: Line | null; onLineNavigation?: () => void };
export function Lines({ onTrip, user = null, onLogin, selectedLine, onLineNavigation }: LinesProps) {
  const { t } = useLanguage();
  const styles = useStyles();
  const [line, setLine] = useState<Line | null>(selectedLine ?? null);
  const [route, setRoute] = useState<Route | null>(null);
  const [filter, setFilter] = useState<"all" | LineStatus>("all");
  const [reminder, setReminder] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const catalog = useResource<{ lineas: Line[]; version?: string }>("/red/lineas?todas=1", true);
  const routes = useResource<{ recorridos: Route[] }>(line ? `/red/lineas/${line.id}/recorridos` : null);
  const stops = useResource<{ paraderos: Stop[] }>(route ? `/red/recorridos/${route.id}/paraderos` : null);
  const saved = useFavorites(user);
  useEffect(() => { if (selectedLine) { setLine(selectedLine); setRoute(null); } }, [selectedLine]);
  const list = catalog.data?.lineas.filter((item) => filter === "all" || item.estado === filter) ?? [];
  const entrance = useListEntrance("lines", list.length, !line && !!catalog.data);
  const stopsEntrance = useListEntrance("line-stops", stops.data?.paraderos.length ?? 0, !!line && !!route);
  const resource = line ? routes : catalog;
  async function toggle(pulse: () => Promise<void>, routeId?: number) {
    if (!line || busy) return;
    setBusy(true); setError("");
    try {
      const input = { linea_id: line.id, recorrido_id: routeId };
      const favorite = saved.find(input);
      if (favorite) await removeFavorite(user, favorite);
      else if (await addFavorite(user, input)) setReminder(true);
      void pulse();
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  const lineSaved = !!line && !!saved.find({ linea_id: line.id });
  const routeSaved = !!line && !!route && !!saved.find({ linea_id: line.id, recorrido_id: route.id });
  const version = catalog.data?.version ?? catalog.data?.lineas.find((item) => item.fuente)?.fuente?.replace(/^gtfs:/, "");
  return <View style={styles.page}>
    {line && <Back label={t("lines.list")} onPress={() => { setLine(null); setRoute(null); onLineNavigation?.(); }} />}
    <Text accessibilityRole="header" style={styles.title}>{line?.nombre ?? t("lines.title")}</Text>
    <Text style={styles.subtitle}>{t("lines.intro")}</Text>
    {reminder && <View accessibilityLiveRegion="polite" style={{ gap: 8 }}>
      <Notice kind="info" message={t("lines.reminder")} />
      {onLogin && <Button title={t("lines.login")} onPress={onLogin} />}
      <Button secondary title={t("lines.dismiss")} onPress={() => setReminder(false)} />
    </View>}
    {!!error && <Notice message={t(error)} />}
    {!!saved.error && <Notice message={t(saved.error)} retry={saved.reload} stale={saved.favorites.length > 0} />}
    {!line && <Segmented label={t("lines.filter")} value={filter} onChange={setFilter} options={[
      { value: "all", label: t("lines.all") }, { value: "activa", label: t("lines.active") },
      { value: "inactiva", label: t("lines.inactive") }, { value: "temporal", label: t("lines.temporary") },
    ]} />}
    {resource.loading && !resource.data && !resource.error && <Loading />}
    {!!resource.error && <Notice message={resource.error} retry={() => void resource.reload()} stale={!!resource.data} />}
    {!line && list.map((item, index) => <Animated.View key={item.id} style={entrance(index)}>
      <LinePlate line={item} status={item.estado ?? "activa"} onPress={() => { setLine(item); onLineNavigation?.(); }} />
    </Animated.View>)}
    {!line && catalog.data && !list.length && <Empty title={t("lines.empty")} text={t("lines.emptyHelp")} />}
    {line && <>
      <LinePlate line={line} status={catalog.data?.lineas.find((item) => item.id === line.id)?.estado ?? line.estado ?? "activa"} />
      {(!user || user.rol === "pasajero") && <FavoriteButton key={line.id} saved={lineSaved} title={t(lineSaved ? "lines.remove" : "lines.add")} busy={busy} disabled={saved.loading || !!saved.error} onPress={(pulse) => void toggle(pulse)} />}
      <Text accessibilityRole="header" style={styles.section}>{t("lines.routes")}</Text>
      <Segmented label={t("lines.routes")} value={route?.id ?? -1} onChange={(id) => setRoute(routes.data?.recorridos.find((item) => item.id === id) ?? null)}
        options={[...(routes.data?.recorridos ?? [])].sort((a, b) => Number(!!a.variante) - Number(!!b.variante)).map((item) => ({ value: item.id, label: t("lines.route", { code: item.codigo ?? line.codigo, direction: item.sentido, name: item.nombre }) }))} />
      {routes.data?.recorridos.length === 0 && <Empty title={t("lines.empty")} text={t("lines.emptyHelp")} />}
    </>}
    {line && route && <>
      <LinePlate line={{ ...line, codigo: route.codigo ?? line.codigo, nombre: route.nombre }} subtitle={route.sentido} />
      {(!user || user.rol === "pasajero") && <FavoriteButton key={route.id} saved={routeSaved} title={t(routeSaved ? "lines.remove" : "lines.add")} busy={busy} disabled={saved.loading || !!saved.error} onPress={(pulse) => void toggle(pulse, route.id)} />}
      <Text accessibilityRole="header" style={styles.section}>{t("lines.stops")}</Text>
      {stops.loading && !stops.data && !stops.error && <Loading />}
      {!!stops.error && <Notice message={stops.error} stale={!!stops.data} retry={() => void stops.reload()} />}
      <View testID="ordered-stops" accessibilityRole="list" style={styles.list}>
        {stops.data?.paraderos.map((stop, index) => <Animated.View accessibilityRole="listitem" key={stop.id} style={[styles.listRow, stopsEntrance(index)]}>
          <Text testID="stop-position" style={styles.label}>{stop.posicion}</Text>
          <View style={styles.grow}><Text style={styles.body}>{stop.nombre}</Text><Text style={styles.small}>{stop.codigo}</Text></View>
        </Animated.View>)}
      </View>
      {stops.data?.paraderos.length === 0 && <Empty title={t("lines.empty")} text={t("lines.emptyHelp")} />}
      <Button title={t("lines.trip")} onPress={onTrip} />
    </>}
    {!!version && <Text style={styles.small}>{t("lines.attribution", { version })}</Text>}
  </View>;
}
