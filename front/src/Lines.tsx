import React, { useEffect, useRef, useState } from "react";
import { Animated, Text, TextInput, View } from "react-native";
import type { Line, LineStatus, Route, Stop, User } from "./types";
import { useResource } from "./useResource";
import { Back, Button, Empty, FavoriteButton, Icon, LinePlate, SkeletonRows, Notice, Segmented, useStyles } from "./ui";
import { useTheme } from "./theme";
import { useLanguage } from "./i18n";
import "./i18n/lines";
import { focusRing, ScalePressable, ScrollReveal, useListEntrance, type PressState } from "./motion";
import { addFavorite, removeFavorite, useFavorites } from "./favorites";
import { CoastHero } from "./CoastHero";

export type LinesProps = {
  onTrip: () => void; user?: User | null; onLogin?: () => void; selectedLine?: Line | null; onLineNavigation?: () => void;
  onOpenStop: (stop: Stop, route: Route) => void;
};
function searchable(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function Lines({ onTrip, user = null, onLogin, selectedLine, onLineNavigation, onOpenStop }: LinesProps) {
  const { t } = useLanguage();
  const styles = useStyles();
  const theme = useTheme();
  const [line, setLine] = useState<Line | null>(selectedLine ?? null);
  const [route, setRoute] = useState<Route | null>(null);
  const [filter, setFilter] = useState<"all" | LineStatus>("all");
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [reminder, setReminder] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const catalog = useResource<{ lineas: Line[]; version?: string }>("/red/lineas?todas=1", true);
  const routes = useResource<{ recorridos: Route[] }>(line ? `/red/lineas/${line.id}/recorridos` : null);
  const stops = useResource<{ paraderos: Stop[] }>(route ? `/red/recorridos/${route.id}/paraderos` : null);
  const saved = useFavorites(user);
  useEffect(() => { if (selectedLine) { setLine(selectedLine); setRoute(null); } }, [selectedLine]);
  const needle = searchable(query.trim());
  const list = catalog.data?.lineas.filter((item) =>
    (filter === "all" || (item.estado ?? "activa") === filter) &&
    (!needle || searchable(`${item.codigo} ${item.nombre}`).includes(needle))
  ) ?? [];
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
    {line
      ? <Text accessibilityRole="header" style={styles.title}>{line.nombre}</Text>
      : <CoastHero title={t("lines.title")} subtitle={t("lines.intro")} />}
    {reminder && <View accessibilityLiveRegion="polite" style={{ gap: 8 }}>
      <Notice kind="info" message={t("lines.reminder")} />
      {onLogin && <Button title={t("lines.login")} onPress={onLogin} />}
      <Button secondary title={t("lines.dismiss")} onPress={() => setReminder(false)} />
    </View>}
    {!!error && <Notice message={t(error)} />}
    {!!saved.error && <Notice message={t(saved.error)} retry={saved.reload} stale={saved.favorites.length > 0} />}
    {!line && <View style={{ gap: 10 }}>
      <View style={[{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 10,
        borderWidth: 1, borderColor: searchFocused ? theme.action : theme.border, backgroundColor: theme.paper }, focusRing(searchFocused, theme.action)]}>
        <Icon name="search-outline" size={19} color={theme.muted} />
        <TextInput accessibilityRole="searchbox" accessibilityLabel={t("lines.search")}
          placeholder={t("lines.search")} placeholderTextColor={theme.muted}
          autoCorrect={false} autoCapitalize="none" returnKeyType="search" value={query} onChangeText={setQuery}
          onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
          style={{ flex: 1, minWidth: 48, minHeight: 48, fontSize: 16, fontFamily: theme.fonts.body, color: theme.ink }} />
      </View>
      <Segmented compact label={t("lines.filter")} value={filter} onChange={setFilter} options={[
        { value: "all", label: t("lines.all") }, { value: "activa", label: t("lines.active") },
        { value: "inactiva", label: t("lines.inactive") }, { value: "temporal", label: t("lines.temporary") },
      ]} />
      {catalog.data && <Text accessibilityLiveRegion="polite" style={styles.small}>
        {t(list.length === 1 ? "lines.result" : "lines.results", { count: list.length })}
      </Text>}
    </View>}
    {resource.loading && !resource.data && !resource.error && <SkeletonRows count={6} />}
    {!!resource.error && <Notice message={resource.error} retry={resource.reload} stale={!!resource.data} />}
    {!line && !!list.length && <View style={{ borderTopWidth: 1, borderTopColor: theme.edge }}>
      {list.map((item) => <ScrollReveal key={item.id}>
        <LinePlate line={item} status={item.estado ?? "activa"} onPress={() => { setLine(item); onLineNavigation?.(); }} />
      </ScrollReveal>)}
    </View>}
    {!line && catalog.data && !list.length && <Empty title={t("lines.noResults")} text={t("lines.noResultsHelp")} />}
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
      {stops.loading && !stops.data && !stops.error && <SkeletonRows count={5} />}
      {!!stops.error && <Notice message={stops.error} stale={!!stops.data} retry={stops.reload} />}
      <View testID="ordered-stops" accessibilityRole="list" style={styles.list}>
        {stops.data?.paraderos.map((stop, index) => <Animated.View accessibilityRole="listitem" key={stop.id} style={stopsEntrance(index)}>
          <ScrollReveal><ScalePressable accessibilityRole="button" accessibilityLabel={t("lines.openStop", { name: stop.nombre, code: stop.codigo })}
            onPress={() => onOpenStop(stop, route)}
            style={({ focused, pressed }: PressState) => [styles.listRow, { minHeight: 48, paddingHorizontal: 8,
              backgroundColor: focused || pressed ? theme.surface : theme.paper }, focusRing(focused, theme.action)]}>
            <Text testID="stop-position" style={styles.label}>{stop.posicion}</Text>
            <View style={styles.grow}><Text style={styles.body}>{stop.nombre}</Text><Text style={styles.small}>{stop.codigo}</Text></View>
            <Icon name="map-outline" size={20} color={theme.action} />
          </ScalePressable></ScrollReveal>
        </Animated.View>)}
      </View>
      {stops.data?.paraderos.length === 0 && <Empty title={t("lines.empty")} text={t("lines.emptyHelp")} />}
      <Button title={t("lines.trip")} onPress={onTrip} />
    </>}
    {!!version && <Text style={styles.small}>{t("lines.attribution", { version })}</Text>}
  </View>;
}
